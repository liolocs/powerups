import test from "@rcompat/test";
import generateRecipe from "#generate-recipe";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const dryFolder = root.append("/.dry");
const recipesFolder = dryFolder.append("/recipes");

test.case("gen recipe creates a recipe.json file", async assert => {
  await fs.create(dryFolder);

  await generateRecipe.run({
    subcommands: ["recipe"],
    flags: [{ flag: "--name", value: "test-recipe" }],
  });

  const recipePath = recipesFolder.append("/test-recipe.json");
  const hasRecipe = await fs.exists(recipePath);
  assert(hasRecipe).equals(true);

  await dryFolder.remove();
});
