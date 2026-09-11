import { Command } from "@liolocs/program";

import init from "#commands/harness/init";
import update from "#commands/harness/update";
import remove from "#commands/harness/remove";

const harness = new Command({
  name: "harness",
  description: "Install, update, or remove powerup skills in an AI coding harness",
  flags: [],
  subcommands: [init, update, remove],
  requiresSubcommand: true,

  action: async () => {},
});

export default harness;