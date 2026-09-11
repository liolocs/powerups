import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import { Command, type Flag } from "@liolocs/program";

import { globalSkillsDir } from "#constants";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
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

const remove = new Command({
  name: "remove",
  description: "Remove installed powerup skills from a harness's global skills dir",
  flags: [dryRunFlag],
  subcommands: [],

  action: async ({ subcommands, flags, context }) => {
    const harness = parseHarness({ subcommands });
    const isDryRun = flags.dryRun === true;
    const destination = fs.ref(globalSkillsDir({ harness, homeDir: context?.homeDir }));
    const { instructions } = await loadHarnessSkills();

    for (const step of instructions.steps) {
      if (step.type !== "create" && step.type !== "dynamic-create") {
        continue;
      }

      const skillFile = destination.append(`/${resolveOutputPath({
        outputPath: step.outputPath,
        variables: buildSkillVariables(),
      })}`);
      const skillDir = skillFile.directory;

      if (!(await skillDir.exists())) {
        cli.print(cli.fg.dim(`Skipped: ${step.name}\n`));
        continue;
      }

      if (isDryRun) {
        cli.print(cli.fg.dim(`Would remove: ${skillDir.path}\n`));
        continue;
      }

      await skillDir.remove({ recursive: true });
      cli.print(cli.fg.dim(`Removed: ${skillDir.path}\n`));
    }
  },
});

export default remove;