import { Command } from "@saved/program";
import { CLI_NAME } from "#constants";
import createCreateCommand from "#commands/output/create/index";
import createApplyCommand from "#commands/output/apply/index";
import createSearchCommand from "#commands/output/search/index";
import createValidateCommand from "#commands/output/validate/index";

const feature = new Command({
  name: "feature",
  description: `Manage ${CLI_NAME} features`,
  flags: [],
  subcommands: [
    createCreateCommand("feature"),
    createApplyCommand("feature"),
    createSearchCommand("feature"),
    createValidateCommand("feature"),
  ],
  requiresSubcommand: true,
  action: () => {},
});

export default feature;