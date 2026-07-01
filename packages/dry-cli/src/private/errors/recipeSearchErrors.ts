import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const recipe_search_errors = error.coded({
  no_matching_recipes: () => {
    const errorText =
      "No matching recipes found.";
    return t`${errorBGText}${errorText}`;
  },
});

export type RecipeSearchErrorCode = keyof typeof recipe_search_errors;

export const RecipeSearchErrorCode = Object.fromEntries(
  Object.keys(recipe_search_errors).map(k => [k, k]),
) as { [K in RecipeSearchErrorCode]: K };

export default recipe_search_errors;
