import fs from "@rcompat/fs";
import { Command, type Flag } from "@liolocs/program";

import { globalSkillsDir } from "#constants";
import runPowerup from "#utils/use/run-powerup/index";
import buildSkillVariables from "#utils/harness/build-skill-variables";
import loadHarnessSkills from "#utils/harness/load-harness-skills";
import parseHarness from "#utils/harness/parse-harness";

const dryRunFlag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

const init = new Command({
  name: "init",
  description: "Install powerup skills into a harness's global skills dir",
  flags: [dryRunFlag],
  subcommands: [],

  action: async ({ subcommands, flags, context }) => {
    const harness = parseHarness({ subcommands });
    const isDryRun = flags.dryRun === true;
    const destination = fs.ref(globalSkillsDir({ harness, homeDir: context?.homeDir }));
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
      overwriteExisting: false,
      saveManifest: false,
      skipInstallSteps: true,
    });
  },
});

export default init;