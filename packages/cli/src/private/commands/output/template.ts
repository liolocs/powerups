import { Command } from "@saved/program";
import { CLI_NAME } from "#constants";
import createCreateCommand from "#commands/output/create";
import createApplyCommand from "#commands/output/apply";
import createSearchCommand from "#commands/output/search";
import createValidateCommand from "#commands/output/validate";

const template = new Command({
  name: "template",
  description: `Manage ${CLI_NAME} templates`,
  flags: [],
  subcommands: [
    createCreateCommand("template"),
    createApplyCommand("template"),
    createSearchCommand("template"),
    createValidateCommand("template"),
  ],
  requiresSubcommand: true,
  action: () => {},
});

export default template;