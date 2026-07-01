import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_recipe_errors from "#errors/generateRecipeErrors";
const recipe = new Command({
    name: "recipe",
    description: "Generate a recipe file",
    flags: [
        {
            name: "name",
            long: "name",
            short: "n",
            description: "Recipe name",
            required: true,
        },
        {
            name: "intent",
            long: "intent",
            short: "i",
            description: "Comma-separated intent strings",
        },
        {
            name: "variables",
            long: "variables",
            short: "v",
            description: "Comma-separated variable names",
        },
        {
            name: "output",
            long: "output",
            short: "o",
            description: "JSON output specification",
        },
    ],
    subcommands: [],
    action: async ({ flags }) => {
        const root = await runtime.projectRoot();
        const dryFolder = root.append("/.dry");
        const hasDryFolder = await fs.exists(dryFolder);
        if (!hasDryFolder) {
            throw generate_recipe_errors.dry_folder_not_found();
        }
        const name = flags.name;
        const recipesFolder = dryFolder.append("/recipes");
        const recipePath = recipesFolder.append(`/${name}.json`);
        const hasRecipe = await fs.exists(recipePath);
        if (hasRecipe) {
            throw generate_recipe_errors.recipe_already_exists(name);
        }
        const intent = is.defined(flags.intent) === true
            ? flags.intent.split(",").map(s => s.trim()).filter(Boolean)
            : [];
        const variables = is.defined(flags.variables) === true
            ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
            : [];
        let output = { files: [] };
        if (is.defined(flags.output) === true) {
            try {
                output = JSON.parse(flags.output);
            }
            catch {
                throw generate_recipe_errors.invalid_output_json();
            }
        }
        await recipePath.writeJSON({
            name,
            variables,
            intent,
            output,
        });
        for (const file of is.array(output.files) === true ? output.files : []) {
            if (is.defined(file.template) === true) {
                const templatePath = recipesFolder.append(`/${file.template}`);
                const hasTemplate = await fs.exists(templatePath);
                if (!hasTemplate) {
                    await templatePath.write("");
                }
            }
        }
        cli.print(`Generated recipe: ${name}`);
    },
});
const generateRecipe = new Command({
    name: "gen",
    description: "Generate dryai resources",
    flags: [],
    subcommands: [recipe],
    requiresSubcommand: true,
    action: () => { },
});
export default generateRecipe;
//# sourceMappingURL=generate-recipe.js.map