import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import { InstallErrorCode } from "#errors/installErrors";
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";

const dryRunFlag: Flag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
};

const install = new Command({
  name: "install",

  description: `install a ${SINGULAR_NAME_FOR_CLI} locally or globally`,

  flags: [
    dryRunFlag,
  ],

  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    const isDryRun = is.defined(flags.dryRun);

    const powerupName = subcommands?.[0];
  },
});

export default install;