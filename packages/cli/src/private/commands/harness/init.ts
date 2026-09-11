import fs from "@rcompat/fs";
import { Command } from "@liolocs/program";

import { globalSkillsDir } from "#constants";
import runPowerup from "#utils/use/run-powerup/index";

import { buildSkillVariables, dryRunFlag, loadHarnessSkills, parseHarness }
  from "#commands/harness/shared";

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