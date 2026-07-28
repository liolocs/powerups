import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { homedir } from "node:os";
import path from "node:path";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import { Command } from "@pwrp/program";
import update_errors from "#errors/updateErrors";
import project_errors from "#errors/projectErrors";
import { scaffold } from "#scaffold/index";
import { readConfig, readGlobalConfig, getPackageSource } from "#utils/config";
import { parseSpecifier } from "#utils/parse-specifier";
import { updateNpmPackage, updateGitPackage, type UpdateResult } from "#utils/update-package";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

interface DiscoveredPackage {
  source: string;
  location: "local" | "global";
}

const update = new Command({
  name: "update",

  description: "Update powerups scaffold and/or installed packages",

  flags: [
    {
      name: "all",
      long: "all",
      short: "a",
      description: "Scaffold + update all packages everywhere",
    },
    {
      name: "harness",
      long: "harness",
      short: "H",
      description:
        "Scaffold only. Value(s) override detected harness, comma-separated (claude,opencode,pi,codex)",
    },
    {
      name: "packages",
      long: "packages",
      short: "p",
      description: "Update all packages only (no scaffold)",
    },
    {
      name: "package",
      long: "package",
      short: "",
      description: "Update one specific package by source specifier",
    },
  ],
  subcommands: [],

  action: async ({ subcommands, rawFlags, flags, context }) => {
    const homeDirStr = context?.homeDir ?? homedir();
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    const hasAll = (rawFlags ?? []).some(
      f => f.flag === "--all" || f.flag === "-a",
    );
    const hasHarness =
      is.truthy(flags.harness) ||
      (rawFlags ?? []).some(f => f.flag === "--harness" || f.flag === "-H");
    const hasPackages = (rawFlags ?? []).some(
      f => f.flag === "--packages" || f.flag === "-p",
    );
    const hasPackageFlag = is.defined(flags.package);
    const positionalSource = subcommands?.[0];
    const hasPositional = is.defined(positionalSource);

    if (!hasAll && !hasHarness && !hasPackages && !hasPackageFlag && !hasPositional) {
      throw update_errors.no_mode();
    }

    if (hasAll && hasHarness) {
      throw update_errors.conflicting_flags("--all and --harness");
    }
    if (hasAll && hasPackages) {
      throw update_errors.conflicting_flags("--all and --packages");
    }
    if (hasHarness && hasPackages) {
      throw update_errors.conflicting_flags("--harness and --packages");
    }
    if (hasPackageFlag && hasPositional) {
      throw update_errors.conflicting_flags(
        "--package and a positional source",
      );
    }

    const doScaffold = hasAll || hasHarness;
    const doPackages = hasAll || hasPackages || hasPackageFlag || hasPositional;

    const isSinglePackageUpdate = hasPackageFlag
      ? (flags.package as string)
      : positionalSource;

    if (doScaffold) {
      if (!(await fs.exists(root.append(`/${MAIN_FOLDER}`)))) {
        throw project_errors.project_not_initialized();
      }

      const harnessFlag =
        is.truthy(flags.harness) ? (flags.harness as string) : undefined;
      const scaffoldResult = await scaffold(root, harnessFlag);

      const green = cli.fg.green;
      const dim = cli.fg.dim;

      cli.print(`${green("✓")} Updated ${CLI_NAME} harnesses for project\n`);
      cli.print(`  ${dim("harnesses:")} ${scaffoldResult.harnesses.join(", ")}\n`);

      for (const file of scaffoldResult.filesWritten) {
        cli.print(`  ${dim("wrote:")} ${file}\n`);
      }

      if (doPackages) {
        cli.print("\n");
      }
    }

    if (doPackages) {
      // Discover packages to update
      let toUpdate: DiscoveredPackage[];

      if (is.truthy(isSinglePackageUpdate)) {
        const spec = parseSpecifier(isSinglePackageUpdate!);

        if (spec.type === "internal") {
          throw update_errors.package_not_found(isSinglePackageUpdate!);
        }

        const localDir = root.append(`/${MAIN_FOLDER}/${spec.storePath}`);
        const globalDir = fs.ref(
          path.join(homeDirStr, MAIN_FOLDER, spec.storePath),
        );

        const inLocal = await fs.exists(localDir);
        const inGlobal = await fs.exists(globalDir);

        if (!inLocal && !inGlobal) {
          throw update_errors.package_not_found(isSinglePackageUpdate!);
        }

        toUpdate = [];

        if (inLocal) {
          toUpdate.push({ source: isSinglePackageUpdate!, location: "local" });
        }

        if (inGlobal) {
          toUpdate.push({ source: isSinglePackageUpdate!, location: "global" });
        }
      } else {
        // All packages from both configs
        toUpdate = [];

        const localConfig = await readConfig(root);
        const globalConfig = await readGlobalConfig(homeDirStr);

        for (const entry of localConfig?.packages ?? []) {
          const source = getPackageSource(entry);
          const spec = parseSpecifier(source);

          if (spec.type === "internal") continue;

          toUpdate.push({ source, location: "local" });
        }

        const globalConfigPackages = is.truthy(globalConfig) && is.truthy(globalConfig!.packages)
          ? globalConfig!.packages : [];

        for (const entry of globalConfigPackages) {
          const source = getPackageSource(entry);
          const spec = parseSpecifier(source);

          if (spec.type === "internal") continue;

          toUpdate.push({ source, location: "global" });
        }
      }

      const localCount = toUpdate.filter(p => p.location === "local").length;
      const globalCount = toUpdate.filter(p => p.location === "global").length;

      if (toUpdate.length > 1) {
        cli.print(
          `Updating ${toUpdate.length} packages (local: ${localCount}, global: ${globalCount})...\n\n`,
        );
      }

      const packageResults: UpdateResult[] = [];

      let hadFailure = false;

      for (const pkg of toUpdate) {
        const spec = parseSpecifier(pkg.source);
        const storeRoot = pkg.location === "local"
          ? root.append(`/${MAIN_FOLDER}`)
          : fs.ref(path.join(homeDirStr, MAIN_FOLDER));

        let result: UpdateResult;

        if (spec.type === "npm") {
          result = await updateNpmPackage(
            storeRoot,
            pkg.source,
            spec.name,
            pkg.location,
          );
        } else if (spec.type === "git") {
          result = await updateGitPackage(
            storeRoot,
            pkg.source,
            spec.storePath,
            pkg.location,
          );
        } else {
          continue; // internal, skip
        }

        packageResults.push(result);

        if (is.truthy(result.error)) {
          hadFailure = true;
        }

        const green = cli.fg.green;
        const red = cli.fg.red;
        const dim = cli.fg.dim;
        const symbol = is.truthy(result.error) ? red("✗") : green("✓");

        cli.print(`${symbol} ${pkg.source} (${pkg.location})\n`);

        if (is.truthy(result.error)) {
          cli.print(`  ${result.error}\n`);
        } else if (result.updated) {
          cli.print(`  ${dim(`${result.oldVersion} → ${result.newVersion}`)}\n`);
        } else {
          cli.print(`  ${dim("already current")}\n`);
        }

        if (toUpdate.length > 1) {
          cli.print("\n");
        }
      }

      // Print batch summary
      if (toUpdate.length > 1) {
        const updatedCount = packageResults.filter(r => r.updated).length;
        const currentCount = packageResults.filter(
          r => !r.updated && is.falsy(r.error),
        ).length;
        const failedCount = packageResults.filter(r => is.truthy(r.error)).length;

        cli.print(
          `Summary: ${updatedCount} updated, ${currentCount} already current, ${failedCount} failed\n`,
        );
      }

      // Exit with error if any package failed
      if (hadFailure) {
        const failed = packageResults.filter(r => is.truthy(r.error));

        throw new Error(`${failed.length} package(s) failed to update`);
      }
    }
  },
});

export default update;