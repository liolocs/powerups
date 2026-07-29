import { Command } from "@liolocs/program";
import { CLI_NAME } from "#constants";
import projectInit from "#commands/project/init";

const project = new Command({
  name: "project",

  description: `Manage ${CLI_NAME} project configuration`,

  flags: [],

  subcommands: [projectInit],

  requiresSubcommand: true,

  action: async () => {
    // This action is never called because requiresSubcommand is true
  },
});

export default project;