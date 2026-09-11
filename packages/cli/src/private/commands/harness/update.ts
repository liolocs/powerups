import fs from "@rcompat/fs";
import { Command } from "@liolocs/program";

import { globalSkillsDir } from "#constants";
import runPowerup from "#utils/use/run-powerup/index";

import { buildSkillVariables, dryRunFlag, loadHarnessSkills, parseHarness }
  from "#commands/harness/shared";

const update = new Command({
  name: "update",
  description: "Update installed powerup skills in a harness's global skills dir",
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
      overwriteExisting: true,
      saveManifest: false,
      skipInstallSteps: true,
    });
  },
});

export default update;