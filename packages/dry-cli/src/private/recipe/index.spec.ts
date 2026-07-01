import test from "@rcompat/test";
import recipe from "#recipe/index";

test.case("recipe command fails without subcommands", async assert => {
  let threw = false;
  let errorMessage: string | undefined;

  try {
    await recipe.run({
      subcommands: [],
      flags: [],
    });
  } catch (e) {
    threw = true;
    errorMessage = String((e as Error).message);
  }

  assert(threw).equals(true);
  assert(errorMessage).includes("Missing required subcommand");
});
