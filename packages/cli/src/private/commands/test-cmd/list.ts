import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import testCmd_errors from "#errors/test-cmdErrors";

const testCmdList = new Command({
  name: "list",
  description: "List items",
  flags: [
    {
      name: "format",
      long: "format",
      short: "f",
      description: "Output format",
    }
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    // TODO: implement subcommand logic
  },
});

export default testCmdList;
