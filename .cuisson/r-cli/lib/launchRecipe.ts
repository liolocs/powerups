import fs from "@rcompat/fs";
import outputRecipe from "./outputRecipe";

type Recipe = {
  name: string;
  variables: string[];
  output: {
    files: {
      name: string;
      outputPath: string;
      template: string;
    }[];
  };
};

export default async function launchRecipe({
  recipeDirPath,
  recipeName,
  path,
  args
}: {
  recipeDirPath: string,
  recipeName: string,
  path: string,
  args: Record<string, string>
}) {
  const recipe: Recipe = (await fs.ref(path).import()).default;

  const hasRequiredVariables = recipe.variables.every((variable) => args.hasOwnProperty(variable));

  if (!hasRequiredVariables) {
    console.log(`[x] Recipe ${recipeName} requires variables [${recipe.variables.join(", ")}] to be passed as arguments`);
    return;
  }

  await outputRecipe({ recipeDirPath, files: recipe.output.files, variables: args });
}