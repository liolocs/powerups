import { Command } from "@dryai/program";
import generate from "#commands/pattern/generate";
import search from "#commands/pattern/search";

const pattern = new Command({
  name: "pattern",
  description: "Manage dryai patterns",
  flags: [],
  subcommands: [generate, search],
  requiresSubcommand: true,
  action: () => {},
});

export default pattern;
