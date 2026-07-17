import { Command } from "@powers/program";
import { CLI_NAME } from "#constants";
import createCreateCommand from "#commands/output/create/index";
import createApplyCommand from "#commands/output/apply/index";
import createSearchCommand from "#commands/output/search/index";
import createValidateCommand from "#commands/output/validate/index";
import createListCommand from "#commands/output/list/index";
import createInfoCommand from "#commands/output/info/index";

const feature = new Command({
  name: "feature",
  description: `Manage ${CLI_NAME} features`,
  flags: [],
  subcommands: [
    createCreateCommand("feature"),
    createApplyCommand("feature"),
    createSearchCommand("feature"),
    createValidateCommand("feature"),
    createListCommand("feature"),
    createInfoCommand("feature"),
  ],
  requiresSubcommand: true,
  action: () => {},
});

export default feature;