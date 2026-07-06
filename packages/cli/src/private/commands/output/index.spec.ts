import test from "@rcompat/test";
import output from "#commands/output/index";
import { CommandErrorCode } from "@saved/program";
import type { CodeError } from "@rcompat/error";

test.case("output command fails without subcommands", async assert => {
  let threw = false;
  let errorMessage: string | undefined;

  try {
    await output.run({
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
