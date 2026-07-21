import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powers/program";
import create_errors from "#errors/createErrors";
import validate_errors from "#errors/validateErrors";
import { checkOutput } from "#utils/check-output";
import { resolvePower } from "#utils/resolve-power";
import { instructionsSchema } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  type PowerType,
} from "#constants";

const validate = new Command({
  name: "validate",
  description: "Validate a power and its sub-powers",
  flags: [
    {
      name: "type",
      long: "type",
      short: "t",
      description: "Power type (multi-use or single-use) for disambiguation",
    },
    {
      name: "pack",
      long: "pack",
      short: "pk",
      description: "Package name to validate powers in",
    },
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    // Name is a required positional argument
    const name = subcommands?.[0];
    if (!is.defined(name)) {
      throw validate_errors.missing_name();
    }

    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasMainFolder = await fs.exists(mainFolder);

    if (!hasMainFolder) {
      throw create_errors.dry_folder_not_found();
    }

    // Resolve power via resolvePower (searches both folders)
    const typeFlag = is.defined(flags.type)
      ? (flags.type as PowerType)
      : undefined;
    const resolved = await resolvePower(root, name, typeFlag);

    // If --pack is provided, verify the power is in the specified package
    if (is.defined(flags.pack) && resolved.packageName !== flags.pack) {
      throw validate_errors.invalid(name, `power is in package "${resolved.packageName}", not "${flags.pack}"`);
    }

    const typeFolder = resolved.folder.up(1);

    // Validate the power itself
    const issues = await checkOutput({
      rootOutputDir: typeFolder,
      currentOutputDir: resolved.folder,
    });

    if (issues.length > 0) {
      throw validate_errors.invalid(name, issues.join("; "));
    }

    // Recursively validate includes/sub-powers
    const outputPath = resolved.folder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    let subPowerCount = 0;

    if (is.defined(instructions.includes)) {
      for (const include of instructions.includes) {
        const subPowerFolder = typeFolder.append(`/${include.name}`);

        if (!(await fs.exists(subPowerFolder))) {
          throw validate_errors.invalid(include.name, "sub-power folder not found");
        }

        const subIssues = await checkOutput({
          rootOutputDir: typeFolder,
          currentOutputDir: subPowerFolder,
        });

        if (subIssues.length > 0) {
          throw validate_errors.invalid(include.name, subIssues.join("; "));
        }

        subPowerCount++;
      }
    }

    if (subPowerCount > 0) {
      cli.print(`${name} is valid (including ${subPowerCount} sub-power(s)).\n`);
    } else {
      cli.print(`${name} is valid.\n`);
    }
  },
});

export default validate;