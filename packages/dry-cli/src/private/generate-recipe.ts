import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";

const recipe = new Command({
  name: "recipe",
  description: "Generate a recipe file",
  flags: [
    { name: "name", long: "name", short: "n", description: "Recipe name", required: true },
  ],
  subcommands: [],
  action: async ({ flags }) => {
    const root = await runtime.projectRoot();
    const dryFolder = root.append("/.dry");
    const recipesFolder = dryFolder.append("/recipes");
    const name = flags.name!;
    const recipePath = recipesFolder.append(`/${name}.json`);

    await recipePath.writeJSON({
      name,
      variables: [],
      intent: [],
      output: { files: [] },
    });

    cli.print(`Generated recipe: ${name}`);
  },
});

const generateRecipe = new Command({
  name: "gen",
  description: "Generate dryai resources",
  flags: [],
  subcommands: [recipe],
  requiresSubcommand: true,
  action: () => {},
});

export default generateRecipe;
