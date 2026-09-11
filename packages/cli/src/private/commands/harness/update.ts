import { Command, type Flag } from "@liolocs/program";

import runPowerup from "#utils/use/run-powerup/index";
import buildSkillVariables from "#utils/harness/build-skill-variables";
import loadHarnessSkills from "#utils/harness/load-harness-skills";
import checkHarnessForErrors from "#utils/harness/check-harness-for-errors";
import { getSkillDestination } from "#utils/harness/get-skill-destination";

const dryRunFlag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

const update = new Command({
  name: "update",
  description: "Update installed powerup skills in a harness's global skills dir",
  flags: [dryRunFlag],
  subcommands: [],

  action: async ({ subcommands, flags, context }) => {
    const harness = subcommands?.[0];

    checkHarnessForErrors(harness);

    const isDryRun = flags.dryRun === true;

    const destination = getSkillDestination({
      harness: harness!,
      homeDir: context?.homeDir,
    });

    const { instructions, location, version } = await loadHarnessSkills();

    await runPowerup({
      destination,
      powerupDirectory: location,
      sourceBase: location.append("/dist"),
      instructions,
      isDryRun,
      variables: buildSkillVariables(),
      powerupVersion: version,
      powerupLocation: location.path,
      overwriteExisting: true,
      saveManifest: false,
      skipInstallSteps: true,
    });
  },
});

export default update;