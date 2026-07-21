import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import testCmd_errors from "#errors/test-cmdErrors";

const testCmd = new Command({
  name: "test-cmd",
  description: "Test command",
  flags: [],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();

    // TODO: implement command logic
  },
});

export default testCmd;
