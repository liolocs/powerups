import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_recipe_errors from "#errors/generateRecipeErrors";
import recipe_search_errors from "#errors/recipeSearchErrors";
import tokenize from "#recipe/tokenize";
import scoreRecipe from "#recipe/score-recipe";
import { DRY_FOLDER, RECIPES_FOLDER } from "#constants";
const search = new Command({
    name: "search",
    description: "Search recipes by intent",
    flags: [
        {
            name: "query",
            long: "query",
            short: "q",
            description: "Search query (space-separated keywords)",
        },
    ],
    subcommands: [],
    action: async ({ flags }) => {
        const root = await runtime.projectRoot();
        const dryFolder = root.append(`/${DRY_FOLDER}`);
        const hasDryFolder = await fs.exists(dryFolder);
        if (!hasDryFolder) {
            throw generate_recipe_errors.dry_folder_not_found();
        }
        const recipesFolder = dryFolder.append(`/${RECIPES_FOLDER}`);
        const hasRecipesFolder = await fs.exists(recipesFolder);
        if (!hasRecipesFolder) {
            throw recipe_search_errors.no_matching_recipes();
        }
        const query = is.defined(flags.query) && flags.query.length > 0
            ? flags.query
            : "";
        const queryKeywords = tokenize(query);
        if (queryKeywords.length === 0) {
            throw recipe_search_errors.no_matching_recipes();
        }
        const recipeFiles = await recipesFolder.files({
            recursive: true,
            filter: (file) => file.name === "instructions.json",
        });
        if (recipeFiles.length === 0) {
            throw recipe_search_errors.no_matching_recipes();
        }
        const results = [];
        for (const recipeFile of recipeFiles) {
            const recipe = await recipeFile.json();
            const score = scoreRecipe(recipe, queryKeywords);
            if (score === 0) {
                continue;
            }
            results.push({
                name: recipe.name,
                score,
                fileCount: recipe.output.files.length,
            });
        }
        if (results.length === 0) {
            throw recipe_search_errors.no_matching_recipes();
        }
        results.sort((a, b) => b.score - a.score);
        cli.print(`Found ${results.length} matching recipe(s):`);
        cli.print("Highest rank first");
        cli.print("");
        results.forEach((result, index) => {
            const score_text = `score: ${result.score}`;
            const files_text = `files: ${result.fileCount}`;
            const score_and_files_text = `(${score_text}, ${files_text})`;
            cli.print(`  [${index + 1}] ${result.name} ${score_and_files_text}`);
        });
    },
});
export default search;
//# sourceMappingURL=search.js.map