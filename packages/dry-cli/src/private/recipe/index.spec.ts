import test from "@rcompat/test";
import recipe from "#recipe/index";
import { CommandErrorCode } from "@dryai/program";
import type { CodeError } from "@rcompat/error";

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
    errorMessage = String((e as CodeError).code);
  }

  assert(threw).equals(true);
  assert(errorMessage).equals(CommandErrorCode.missing_required_subcommand);
});
