import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import checkForPreUseErrors from "#utils/use/check-for-pre-use-errors/index";
import getPowerup from "#utils/use/get-powerup/getPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import runPowerup from "#utils/use/run-powerup/index";
import extractVariables from "#utils/use/extract-variables";
import setupRoot from "#utils/use/setupRoot/index";

const EXCLUDE_FLAGS = ["--dry-run", "-dr", "--help", "-h"];

const dryRunFlag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

const targetDirFlag = {
  name: "targetDir",
  long: "target-dir",
  short: "td",
  description: "Target directory for the use command",
} as const satisfies Flag;

const use = new Command({
  name: "use",

  description: `Use a ${SINGULAR_NAME_FOR_CLI}`,

  flags: [
    dryRunFlag,
    targetDirFlag,
  ],

  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const root = await setupRoot({
      contextRoot: context?.root,
      cwd: runtime.cwd(),
      targetDir: flags.targetDir,
    });

    const isDryRun = flags.dryRun === true;

    const powerupName = subcommands?.[0];

    await checkForPreUseErrors({ cwd: root, powerupName });

    const powerup = await getPowerup({
      cwd: root,
      name: powerupName!,
      globalPowerupsDir: fs.ref(GLOBAL_ROOT),
    });

    const {
      validatedCompiledInstructions,
    } = await checkCompiledInstructionsForErrors(
      powerup.instructions,
    );

    const variables = extractVariables({
      rawFlags: rawFlags ?? [],
      variables: validatedCompiledInstructions.variables,
      excludeFlags: EXCLUDE_FLAGS,
      powerupName: powerupName!,
    });

    await runPowerup({
      destination: root,
      powerupDirectory: powerup.location,
      instructions: validatedCompiledInstructions,
      isDryRun,
      variables,
      powerupVersion: powerup.version,
      powerupLocation: powerup.location.path,
    });
  },
});

export default use;