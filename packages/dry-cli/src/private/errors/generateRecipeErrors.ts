import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const generate_recipe_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText =
      `Dry folder not found. Run "dryai init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  recipe_already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `Recipe ${nameText} already exists.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_output_json: () => {
    const errorText =
      "Invalid JSON for --output flag.";
    return t`${errorBGText}${errorText}`;
  },
});

export type GenerateRecipeErrorCode = keyof typeof generate_recipe_errors;

export const GenerateRecipeErrorCode = Object.fromEntries(
  Object.keys(generate_recipe_errors).map(k => [k, k]),
) as { [K in GenerateRecipeErrorCode]: K };

export default generate_recipe_errors;
