import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@pwrp/program";
import validate_errors from "#errors/validateErrors";
import { checkOutput } from "#utils/check-output";
import { resolvePowerUp } from "#utils/resolve-powerup";
import { instructionsSchema } from "#schemas/instruction";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  CLI_NAME,
  SINGULAR_NAME,
  type PowerUpType,
} from "#constants";

const validate = new Command({
  name: "validate",

  description: `Validate a ${SINGULAR_NAME} and its included ${CLI_NAME}`,

  flags: [
    {
      name: "type",
      long: "type",
      short: "t",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use) for disambiguation`,
    },
    {
      name: "pack",
      long: "pack",
      short: "pk",
      description: `Package name that contains ${CLI_NAME} to validate`,
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

    // Resolve powerup via resolvePowerUp with global fallback (works anywhere)
    const typeFlag = is.defined(flags.type)
      ? (flags.type as PowerUpType)
      : undefined;
    const resolved = await resolvePowerUp(root, name, typeFlag, {
      fallbackToGlobal: true,
      homeDir: context?.homeDir,
    });

    // If --pack is provided, verify the powerup is in the specified package
    if (is.defined(flags.pack) && resolved.packageName !== flags.pack) {
      throw validate_errors.invalid(name, `${SINGULAR_NAME} is in package "${resolved.packageName}", not "${flags.pack}"`);
    }

    const typeFolder = resolved.folder.up(1);

    // Validate the powerup itself
    const issues = await checkOutput({
      rootOutputDir: typeFolder,
      currentOutputDir: resolved.folder,
    });

    if (issues.length > 0) {
      throw validate_errors.invalid(name, issues.join("; "));
    }

    // Recursively validate included powerups
    const outputPath = resolved.folder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    let subPowerCount = 0;

    for (const step of instructions.steps) {
      if (step.type === "include") {
        const subPowerFolder = typeFolder.append(`/${step.name}`);

        if (!(await fs.exists(subPowerFolder))) {
          throw validate_errors.invalid(step.name, `sub-${SINGULAR_NAME} folder not found`);
        }

        const subIssues = await checkOutput({
          rootOutputDir: typeFolder,
          currentOutputDir: subPowerFolder,
        });

        if (subIssues.length > 0) {
          throw validate_errors.invalid(step.name, subIssues.join("; "));
        }

        subPowerCount++;
      }
    }

    if (subPowerCount > 0) {
      cli.print(`${name} is valid (including ${subPowerCount} sub-${SINGULAR_NAME}(s)).\n`);
    } else {
      cli.print(`${name} is valid.\n`);
    }
  },
});

export default validate;