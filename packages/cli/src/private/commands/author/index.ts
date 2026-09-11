import build from "#commands/author/build/index";
import create from "#commands/author/create/index";
import preview from "#commands/author/preview/index";
import template from "#commands/author/template/index";
import { Command } from "@liolocs/program";

const author = new Command({
  name: "author",
  description: "Commands for powerup authors",
  flags: [],
  subcommands: [build, create, preview, template],
  requiresSubcommand: true,

  action: async () => {},
});

export default author;