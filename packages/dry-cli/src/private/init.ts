import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import init_errors from "#errors/initErrors";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const init = new Command({
  name: "init",
  description: `Initialize a ${CLI_NAME} project`,
  flags: [],
  subcommands: [],
  action: async () => {
    const root = await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (hasDryFolder) {
      throw init_errors.dry_folder_exists();
    }

    await fs.create(mainFolder);

    cli.print(`Initialized ${CLI_NAME} project`);
  },
});

export default init;