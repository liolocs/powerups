import { Command } from "@dryai/program";
import generate from "#commands/pattern/generate";
import run from "#commands/pattern/run";
import search from "#commands/pattern/search";
import validate from "#commands/pattern/validate";

const pattern = new Command({
  name: "pattern",
  description: "Manage dryai patterns",
  flags: [],
  subcommands: [generate, run, search, validate],
  requiresSubcommand: true,
  action: () => {},
});

export default pattern;