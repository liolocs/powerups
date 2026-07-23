import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import project_errors from "#errors/projectErrors";
import { writeConfig } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const projectInit = new Command({
  name: "init",

  description: `Initialize ${CLI_NAME} for the current project`,

  flags: [],

  subcommands: [],

  action: async ({ context }: any) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    if (await fs.exists(mainFolder)) {
      throw project_errors.project_already_initialized();
    }

    await fs.create(mainFolder);
    await writeConfig(root, { packages: [] });

    const green = cli.fg.green;

    cli.print(`${green("✓")} Initialized ${CLI_NAME} for project\n`);
  },
});

export default projectInit;