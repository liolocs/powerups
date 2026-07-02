import { Command } from "@dryai/program";
import summary from "./summary";
import { CLI_NAME } from "#constants";

const metrics = new Command({
  name: "metrics",
  description: `View ${CLI_NAME} usage metrics`,
  flags: [],
  subcommands: [summary],
  requiresSubcommand: true,
  action: () => {},
});

export default metrics;