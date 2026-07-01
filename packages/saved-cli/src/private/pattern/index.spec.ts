import test from "@rcompat/test";
import pattern from "#pattern/index";
import { CommandErrorCode } from "@dryai/program";
import type { CodeError } from "@rcompat/error";

test.case("pattern command fails without subcommands", async assert => {
  let threw = false;
  let errorMessage: string | undefined;

  try {
    await pattern.run({
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
