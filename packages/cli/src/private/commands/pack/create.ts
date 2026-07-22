import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import pack_errors from "#errors/packErrors";
import init_errors from "#errors/initErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  GLOBAL_INTERNAL_PATH,
  GLOBAL_ROOT,
  CLI_NAME,
} from "#constants";

const packCreate = new Command({
  name: "create",
  description: "Create a new package",
  flags: [
    {
      name: "global",
      long: "global",
      short: "g",
      description: "Create the package globally",
    },
    {
      name: "description",
      long: "description",
      short: "d",
      description: "Package description",
    },
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    const packageName = subcommands?.[0];
    if (!is.defined(packageName) || packageName.length === 0) {
      throw pack_errors.invalid_package_name(packageName ?? "");
    }

    if (packageName.includes("/")) {
      throw pack_errors.invalid_package_name(packageName);
    }

    const isGlobal = is.defined(flags.global);
    const description = is.defined(flags.description) ? flags.description : "";

    // Determine base directory
    let baseDir: FileRef;
    if (isGlobal) {
      baseDir = fs.ref(GLOBAL_INTERNAL_PATH);
    } else {
      const root: FileRef = context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);
      if (!(await fs.exists(mainFolder))) {
        throw init_errors.main_folder_not_found();
      }
      baseDir = mainFolder.append(`/${INTERNAL_FOLDER}`);
    }

    const packageDir = baseDir.append(`/${packageName}`);

    // Check if package already exists
    if (await fs.exists(packageDir)) {
      throw pack_errors.package_already_exists(packageName);
    }

    // For global: ensure <GLOBAL_FOLDER> is writable
    if (isGlobal) {
      const globalRoot = fs.ref(GLOBAL_ROOT);
      try {
        await fs.create(globalRoot);
      } catch {
        throw pack_errors.global_not_writable();
      }
    }

    // Create folder structure
    const srcActive = packageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

    // Write package.json
    const packageJson = {
      name: packageName,
      version: "1.0.0",
      description,
      keywords: [KEYWORD_PACKAGE],
      [CLI_NAME]: {
        active: {
          [MULTI_USE_FOLDER]: {},
          [SINGLE_USE_FOLDER]: {},
        },
      },
    };

    await packageDir.append(`/${PACKAGE_FILE}`).writeJSON(packageJson as never);

    const green = cli.fg.green;
    const dim = cli.fg.dim;
    const location = isGlobal ? "global" : "local";

    cli.print(`${green("✓")} Created package: ${packageName} (${location})\n`);
    cli.print(`  ${dim("location:")} ${packageDir.path}\n`);
  },
});

export default packCreate;