import { Command } from "@saved/program";
import generate from "#commands/output/generate";
import run from "#commands/output/run";
import search from "#commands/output/search";
import validate from "#commands/output/validate";
import { CLI_NAME } from "#constants";

const output = new Command({
  name: "output",
  description: `Manage ${CLI_NAME} outputs`,
  flags: [],
  subcommands: [generate, run, search, validate],
  requiresSubcommand: true,
  action: () => {},
});

export default output;