import { Command } from "@saved/program";
import { CLI_NAME } from "#constants";
import createCreateCommand from "#commands/output/create/index";
import createApplyCommand from "#commands/output/apply/index";
import createSearchCommand from "#commands/output/search/index";
import createValidateCommand from "#commands/output/validate/index";
import createListCommand from "#commands/output/list/index";
import createInfoCommand from "#commands/output/info/index";

const template = new Command({
  name: "template",

  description: `Manage ${CLI_NAME} templates`,

  flags: [],

  subcommands: [
    createCreateCommand("template"),
    createApplyCommand("template"),
    createSearchCommand("template"),
    createValidateCommand("template"),
    createListCommand("template"),
    createInfoCommand("template"),
  ],

  requiresSubcommand: true,

  action: () => {},
});

export default template;