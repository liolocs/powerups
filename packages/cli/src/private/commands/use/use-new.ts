import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import fs from "@rcompat/fs";
import checkForPreUseErrors from "#utils/use/check-for-pre-use-errors/index";
import getPowerup from "#utils/use/getPowerup/getPowerup";

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

  action: async ({ context, subcommands, flags }) => {
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

    // /**
    //  * Should check for similar validation that is currently done in the build command (eventually this funcitonality should live in the validate command so lets import it from a #utils/validate/ location and use it in both build and use)
    //  */
    // const validatedPowerup = validatePowerup(powerup);

    // /**
    //  * Should check for
    //  * 1. create destinations should not exist before creation
    //  * 2. Should check for previous manifest entries for the same powerup to ensure a single-use powerup is not applied more than once
    //  */
    // await checkForOtherPreFlightErrors({root, powerup});

    /**
     * Should execute the steps one by one
     * Should skip steps that have already applied
     * Manifest file is created when runStep is called but we also want to create a commit after all steps are run and then add the manifest entries afterwards so that we can mark the commit that was used to run the step
     */
    // await runPowerup({
    //   destination: root,
    //   powerupDir: powerupLocation,
    //   instructions: powerupInstructions,
    //   isDryRun,
    // });
  },
});

export default use;

// function getFlagFromRawFlags(
//   flag: Flag,
//   rawFlags?: Array<{ flag: string; value: string }>,
// ): { flag: string; value: string } | undefined {
//   if (is.falsy(rawFlags)) {
//     return undefined;
//   }

//   const found = rawFlags!.find(f =>
//     f.flag === `--${flag.long}` ||
//     f.flag === `-${flag.short}`);

//   return found;
// }