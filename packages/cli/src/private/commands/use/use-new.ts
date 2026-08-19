import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import fs from "@rcompat/fs";
import checkForPreUseErrors from "#utils/use/check-for-pre-use-errors/index";
import getPowerup from "#utils/use/get-powerup/getPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import checkForUsePreflightErrors from "#utils/use/check-for-use-preflight-errors/index";
import runPowerup from "#utils/use/run-powerup/index";
import extractVariables from "#utils/use/extract-variables";

const EXCLUDE_FLAGS = ["--dry-run", "-d", "--help", "-h"];

const dryRunFlag: Flag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
};

const use = new Command({
  name: "use",

  description: `Use a ${SINGULAR_NAME_FOR_CLI}`,

  flags: [
    dryRunFlag,
  ],

  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    const isDryRun = is.defined(flags.dryRun);

    const powerupName = subcommands?.[0];

    /**
     Check:
     * Powerup was passed
     * Powerup is in config
     * Clean git state
     */
    await checkForPreUseErrors({ cwd: root, powerupName });

    /**
     * Should get the powerup from the local store or global store
     * Should look first in local store, then global store
     * Should give an error if the powerup is not found
     * Should use the config.json locally and the global config.json to get the powerup (installed powerups are registered in the local or global config.json based on where they are installed)
     * The config.json is the same type of file as settings.json for pi.dev except that we record powerups instead of pi extensions
     */
    const powerup = await getPowerup({
      root,
      name: powerupName!,
      globalRoot: fs.ref(GLOBAL_ROOT),
    });

    const {
      validatedCompiledInstructions,
    } = await checkCompiledInstructionsForErrors(
      powerup.instructions,
    );

    // /**
    //  * Should check for
    //  * 1. create destinations should not exist before creation
    //  * 2. Should check for previous manifest entries for the same powerup to ensure a single-use powerup is not applied more than once
    //  */
    // await checkForUsePreflightErrors({ cwd: root, instructions: powerup.instructions });

    const variables = extractVariables({
      rawFlags: rawFlags ?? [],
      variables: validatedCompiledInstructions.variables,
      excludeFlags: EXCLUDE_FLAGS,
      powerupName: powerupName!,
    });

    /**
     * Should execute the steps one by one
     * Should skip steps that have already applied
     * Manifest file is created when runStep is called but we also want to create a commit after all steps are run and then add the manifest entries afterwards so that we can mark the commit that was used to run the step
     */
    await runPowerup({
      destination: root,
      powerupDirectory: powerup.location,
      instructions: validatedCompiledInstructions,
      isDryRun,
      variables,
    });
  },
});

export default use;