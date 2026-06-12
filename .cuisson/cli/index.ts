import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import path from "path";
import launchRecipe from "./launchRecipe.js";
import convertStringArgsToObject from "./utils/convertStringArgsToObject.js";

console.log(runtime.args);

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
  
  await launchRecipe(runtime.args[0], commandToRecipePathMap.get(runtime.args[0])!.path, convertedArgs);
}

runtime.exit(0);