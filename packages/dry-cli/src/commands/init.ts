import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import {Command} from "@dryai/program";
import init_errors from "#errors/initErrors";

const init = new Command({
  name: "init",
  description: "Initialize a dryai project",
  flags: [],
  subcommands: [],
  action: async () => {
    const root = await runtime.projectRoot();
    const dryFolder = root.append(".dry");
    const hasDryFolder = await fs.exists(dryFolder);

    if (hasDryFolder) {
      throw init_errors.dry_folder_exists();
    }

  // look for the .dry folder
  // if it exists, abort
  // create the .dry folder if missing
  },
});

export default init;