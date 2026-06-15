import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import path from "path";
import launchRecipe from "./lib/launchRecipe.js";
import convertStringArgsToObject from "./utils/convert/convertStringArgsToObject.js";

const pathToTemplates = path.resolve(import.meta.dirname, "../", "templates");
const templates = await fs.ref(pathToTemplates);

const recipes = await templates.files({ recursive: true, filter: (file) => file.name.includes("recipe.json") });
const commandToRecipePathMap = new Map(recipes.map((recipe) => [recipe.path.split("/").slice(-2, -1)[0], recipe]));
const commands = Array.from(commandToRecipePathMap.keys());

if (runtime.args.length === 0) {
  console.log("No command specified. Available commands are:");
  console.log(commands);
  runtime.exit(1);
}

if (!commands.includes(runtime.args[0])) {
  console.log("Invalid command specified. Available commands are:");
  console.log(commands);
  runtime.exit(1);
}

const hasValidCommand = commandToRecipePathMap.has(runtime.args[0]);
if (hasValidCommand) {
  const convertedArgs = convertStringArgsToObject(runtime.args.slice(1));

  const recipeDirPath = commandToRecipePathMap.get(runtime.args[0])!.path.split("/").slice(0, -1).join("/");

  await launchRecipe({
    recipeDirPath,
    recipeName: runtime.args[0],
    path: commandToRecipePathMap.get(runtime.args[0])!.path,
    args: convertedArgs
  });
}

runtime.exit(0);