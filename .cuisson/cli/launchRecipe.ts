import fs from "@rcompat/fs";
import {difference} from "@rcompat/array"

type Recipe = {
  name: string;
  variables: string[];
  output: {
    path: string;
    files: {
      name: string;
      template: string;
    }[];
  };
};

export default async function launchRecipe(recipeName: string, path: string, args: Record<string, string>) {
  const recipe: Recipe = (await fs.ref(path).import()).default;
  console.log(`Launching recipe ${recipeName} at ${path}, with args ${args}`);

  const hasRequiredVariables = recipe.variables.every((variable) => args.hasOwnProperty(variable));
  if(!hasRequiredVariables) {
    console.log(`[x] Recipe ${recipeName} requires variables [${recipe.variables.join(", ")}] to be passed as arguments`);
    return;
  }

  console.log("ok to proceed")
}