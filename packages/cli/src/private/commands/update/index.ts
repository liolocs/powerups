import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import { homedir } from "node:os";
import path from "node:path";
import { Command } from "@powerups/program";
import init_errors from "#errors/initErrors";
import { scaffold } from "#scaffold/index";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const update = new Command({
  name: "update",

  description: "Regenerate the global docs scaffolded on init",

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
    const homeDirStr = context?.homeDir ?? homedir();
    const homeDir = fs.ref(homeDirStr);
    const globalRoot = fs.ref(path.join(homeDirStr, MAIN_FOLDER));

    if (!(await fs.exists(globalRoot))) {
      throw init_errors.global_not_initialized();
    }

    const harnessFlag = flags.harness !== undefined ? flags.harness as string : undefined;

    // scaffold detects harnesses globally and writes to all of them
    const result = await scaffold(homeDir, harnessFlag);

    // No config read/write — nothing to persist

    const green = cli.fg.green;
    const dim = cli.fg.dim;

    cli.print(`${green("✓")} Updated ${CLI_NAME} globally\n`);
    cli.print(`  ${dim("harnesses:")} ${result.harnesses.join(", ")}\n`);

    for (const file of result.filesWritten) {
      cli.print(`  ${dim("wrote:")} ${file}\n`);
    }
  },
});

export default update;