import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import install_errors from "#errors/installErrors";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";
import { parseSpecifier } from "#utils/parse-specifier";
import { parseFragment, mergeFilters, buildConfigEntry } from "#utils/parse-powerup-fragment";
import { installNpmPackage, installGitPackage } from "#utils/install-package";
import { packageJsonSchema } from "#schemas/package";
import {
  MAIN_FOLDER,
  GLOBAL_ROOT,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
} from "#constants";

const install = new Command({
  name: "install",
  description: "Install a powerup package from npm or git",
  flags: [
    {
      name: "include",
      long: "include",
      short: "i",
      description: "Comma-delimited powerup names to include",
    },
    {
      name: "exclude",
      long: "exclude",
      short: "x",
      description: "Comma-delimited powerup names to exclude",
    },
    {
      name: "global",
      long: "global",
      short: "g",
      description: "Install to global store instead of local",
    },
  ],
  subcommands: [],
  action: async ({ subcommands, rawFlags, flags, context }) => {
    // 1. Extract source from positional args
    const rawSource = subcommands?.[0];
    if (!is.defined(rawSource)) {
      throw install_errors.missing_source();
    }

    // 2. Parse fragment + merge with flags
    const { source, filter: fragmentFilter } = parseFragment(rawSource!);
    const filter = mergeFilters(
      fragmentFilter,
      flags.include as string | undefined,
      flags.exclude as string | undefined,
    );

    // 3. Parse specifier
    const spec = parseSpecifier(source);

    // 4. Internal packages can't be installed
    if (spec.type === "internal") {
      throw install_errors.internal_not_installable(source);
    }

    // 5. Determine store root (--global is a boolean flag, check rawFlags)
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const isGlobal = (rawFlags ?? []).some(
      f => f.flag === "--global" || f.flag === "-g",
    );
    const storeRoot = isGlobal ? fs.ref(GLOBAL_ROOT) : root.append(`/${MAIN_FOLDER}`);

    // 6. Fetch the package
    if (spec.type === "npm") {
      await installNpmPackage(storeRoot, spec.name);
    } else {
      await installGitPackage(storeRoot, source, spec.storePath);
    }

    // 7. Validate the installed package has powerups property
    const packageDir = storeRoot.append(`/${spec.storePath}`);
    const pkgJsonPath = packageDir.append(`/${PACKAGE_FILE}`);
    if (!(await fs.exists(pkgJsonPath))) {
      throw install_errors.fetch_failed(source, "package.json not found after install");
    }

    const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
    // Validate it's a powerups package (check keywords for powerups-package)
    if (!pkgJson.keywords.includes(KEYWORD_PACKAGE)) {
      throw install_errors.not_a_powerups_package(source);
    }

    // 8. Build config entry
    const entry = buildConfigEntry(source, filter);

    // 9. Register in config
    if (isGlobal) {
      await addPackageToGlobalConfig(entry);
    }
    // Always add to project config
    await addPackageToConfig(root, entry);

    // 10. Print success
    const green = cli.fg.green;
    const dim = cli.fg.dim;
    cli.print(`${green("✓")} Installed ${source}\n`);
    cli.print(`  ${dim("location:")} ${isGlobal ? "global" : "local"}\n`);
    cli.print(`  ${dim("store:")} ${spec.type}\n`);
    if (filter.include || filter.exclude) {
      const active = filter.include ?? "all";
      cli.print(`  ${dim("powerups:")} ${active}${filter.exclude ? ` (excluding ${filter.exclude.join(", ")})` : ""}\n`);
    } else {
      cli.print(`  ${dim("powerups:")} all\n`);
    }
  },
});

export default install;