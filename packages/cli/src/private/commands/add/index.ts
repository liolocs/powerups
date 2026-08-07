import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import add_errors from "#errors/addErrors";
import { addPackageToConfig } from "#utils/config";
import { parseFragment, mergeFilters, buildConfigEntry } from "#utils/parse-powerup-fragment";
import { resolvePackage } from "#utils/resolve-powerup";
import { packageJsonSchema } from "#schemas/package";
import {
  CLI_NAME,
  CLI_FOLDER_NAME,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_JSON,
  PACKAGE_JSON_KEYWORD_PROPERTY,
} from "#constants";

const add = new Command({
  name: "add",
  description: "Add an installed powerup package to this project's config",
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
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    // 1. Extract source from positional args
    const rawSource = subcommands?.[0];
    if (!is.defined(rawSource)) {
      throw add_errors.missing_source();
    }

    // 2. Parse fragment + merge with flags
    const { source, filter: fragmentFilter } = parseFragment(rawSource!);
    const filter = mergeFilters(
      fragmentFilter,
      flags.include as string | undefined,
      flags.exclude as string | undefined,
    );

    // 3. Require project init before adding packages
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${CLI_FOLDER_NAME}`);
    if (!(await fs.exists(mainFolder))) {
      throw add_errors.project_not_initialized();
    }

    // 4. Verify package exists in local or global store
    const pkgLoc = await resolvePackage(root, source);
    if (pkgLoc === null) {
      throw add_errors.package_not_installed(source);
    }

    // 5. Validate it's a powerups package
    const pkgJsonPath = pkgLoc.packageDir.append(`/${PACKAGE_JSON}`);
    const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
    if (!pkgJson.keywords.includes(PACKAGE_JSON_KEYWORD_PROPERTY)) {
      throw add_errors.not_a_powerups_package(source);
    }

    // 6. Soft validate powerup names if include/exclude specified
    if (filter.include || filter.exclude) {
      const active = pkgJson[CLI_NAME].active;
      const allPowerups = new Set<string>();
      const multiUse = active[MULTI_USE_FOLDER] ?? {};
      const singleUse = active[SINGLE_USE_FOLDER] ?? {};
      for (const name of Object.keys(multiUse)) allPowerups.add(name);
      for (const name of Object.keys(singleUse)) allPowerups.add(name);

      if (filter.include) {
        for (const name of filter.include) {
          if (!allPowerups.has(name)) {
            cli.print(`Warning: powerup "${name}" not found in package ${source}\n`);
          }
        }
      }
      if (filter.exclude) {
        for (const name of filter.exclude) {
          if (!allPowerups.has(name)) {
            cli.print(`Warning: powerup "${name}" not found in package ${source}\n`);
          }
        }
      }
    }

    // 7. Build config entry
    const entry = buildConfigEntry(source, filter);

    // 8. Register in project config
    await addPackageToConfig(root, entry);

    // 9. Print success
    const green = cli.fg.green;
    const dim = cli.fg.dim;
    cli.print(`${green("✓")} Added ${source} to project config\n`);
    cli.print(`  ${dim("location:")} ${pkgLoc.location}\n`);
    if (filter.include || filter.exclude) {
      const active = filter.include ?? "all";
      cli.print(`  ${dim("powerups:")} ${active}${filter.exclude ? ` (excluding ${filter.exclude.join(", ")})` : ""}\n`);
    } else {
      cli.print(`  ${dim("powerups:")} all\n`);
    }
  },
});

export default add;