import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import init_errors from "#errors/initErrors";
import { scaffold } from "#scaffold/index";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const init = new Command({
  name: "init",
  description: `Initialize a ${CLI_NAME} project in the current directory`,
  flags: [
    {
      name: "harness",
      long: "harness",
      short: "H",
      description: "Override harness detection (claude|opencode|pi|codex)",
    },
  ],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    if (await fs.exists(mainFolder)) {
      throw init_errors.dry_folder_exists();
    }

    await fs.create(mainFolder);

    // Run scaffold with optional --harness override
    const harnessFlag = props?.flags?.harness as string | undefined;
    const result = await scaffold(root, harnessFlag, {
      skipGlobal: props?.context?.skipGlobal,
    });

    cli.print(`Initialized ${CLI_NAME} project`);
    cli.print(`Detected harness: ${result.harness}`);
    for (const file of result.filesWritten) {
      cli.print(`Wrote ${file}`);
    }
  },
});

export default init;