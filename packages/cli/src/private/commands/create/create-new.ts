import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";

const dryRunFlag: Flag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
};

const captureFlag: Flag = {
  name: "capture",
  long: "capture",
  short: "c",
  description: `Setting to determine which files you wish you capture when creating your new ${SINGULAR_NAME_FOR_CLI}`,
};

const create = new Command({
  name: "create",

  description: `Create a ${SINGULAR_NAME_FOR_CLI}`,

  flags: [dryRunFlag, captureFlag],

  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    const isDryRun = is.defined(flags.dryRun);

    const powerupName = subcommands?.[0];
  },
});

export default create;