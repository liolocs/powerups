import { Command } from "@pwrp/program";
import { CLI_NAME } from "#constants";
import packCreate from "#commands/pack/create";
import packMove from "#commands/pack/move";

const pack = new Command({
  name: "pack",

  description: `Create and move ${CLI_NAME} packages`,

  flags: [],

  subcommands: [packCreate, packMove],

  requiresSubcommand: true,

  action: async () => {
    // This action is never called because requiresSubcommand is true
  },
});

export default pack;