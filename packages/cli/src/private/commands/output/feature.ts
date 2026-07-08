import { Command } from "@saved/program";
import { CLI_NAME } from "#constants";
import createCreateCommand from "#commands/output/create";
import createApplyCommand from "#commands/output/apply";
import createSearchCommand from "#commands/output/search";
import createValidateCommand from "#commands/output/validate";

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