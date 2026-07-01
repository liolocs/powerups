import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_recipe_errors from "#errors/generateRecipeErrors";
import recipe_search_errors from "#errors/recipeSearchErrors";

const DELIMITERS = " ,;:.-_()[]{}\"'?!";

function tokenize(input: string): string[] {
  const lower = input.toLowerCase();
  const keywords: string[] = [];
  let current = "";

  for (const ch of lower) {
    if (DELIMITERS.includes(ch)) {
      if (current.length > 0) {
        keywords.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    keywords.push(current);
  }

  return keywords;
}

function scoreRecipe(
  recipe: { intent: string[] },
  queryKeywords: string[],
): number {
  const intentTokens = new Set<string>();

  for (const intentStr of recipe.intent) {
    for (const token of tokenize(intentStr)) {
      intentTokens.add(token);
    }
  }

  let score = 0;
  for (const qk of queryKeywords) {
    if (intentTokens.has(qk)) {
      score++;
    }
  }

  return score;
}

interface SearchResult {
  name: string;
  score: number;
  fileCount: number;
}

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
    const dryFolder = root.append("/.dry");
    const hasDryFolder = await fs.exists(dryFolder);

    if (!hasDryFolder) {
      throw generate_recipe_errors.dry_folder_not_found();
    }

    const recipesFolder = dryFolder.append("/recipes");
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
      filter: (file) => file.extension === ".json",
    });

    if (recipeFiles.length === 0) {
      throw recipe_search_errors.no_matching_recipes();
    }

    const results: SearchResult[] = [];

    for (const recipeFile of recipeFiles) {
      const recipe = await recipeFile.json() as {
        name: string;
        intent: string[];
        output: { files: unknown[] };
      };

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
      cli.print(`  [${index + 1}] ${result.name} (score: ${result.score}, files: ${result.fileCount})`);
    });
  },
});

export default search;
