import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import init_errors from "#errors/initErrors";
import update_errors from "#errors/updateErrors";
import { scaffold } from "#scaffold/index";
import { readConfig, writeConfig } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const update = new Command({
  name: "update",

  description: `Regenerate the docs scaffolded on init`,

  flags: [
    {
      name: "harness",
      long: "harness",
      short: "H",
      description:
        "Override the harness stored in config ( claude | opencode | pi | codex )",
    },
  ],

  subcommands: [],

  action: async ({ context, flags }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    if (!(await fs.exists(mainFolder))) {
      throw init_errors.dry_folder_not_found();
    }

    // Resolve the harness: --harness flag takes priority, otherwise read
    // from config.  If neither is available, require the user to specify
    // --harness explicitly.
    let harnessFlag: string | undefined;

    if (flags.harness !== undefined) {
      harnessFlag = flags.harness as string;
    } else {
      const config = await readConfig(root);
      if (config === null) {
        throw update_errors.no_harness_config();
      }
      harnessFlag = config.harness;
    }

    // scaffold() calls detectHarness() which validates the harness value
    // and throws invalid_harness if it's not one of the valid options.
    const result = await scaffold(root, harnessFlag, {
      skipGlobal: context?.skipGlobal,
    });

    // Persist the harness override only after scaffold succeeds, so an
    // invalid harness value never gets written to config.
    if (flags.harness !== undefined) {
      await writeConfig(root, { harness: result.harness });
    }

    const green = cli.fg.green;
    const dim = cli.fg.dim;

    cli.print(`${green("✓")} Updated ${CLI_NAME} project\n`);
    cli.print(`  ${dim("harness:")} ${result.harness}\n`);

    for (const file of result.filesWritten) {
      cli.print(`  ${dim("wrote:")} ${file}\n`);
    }
  },
});

export default update;