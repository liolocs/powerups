import test from "@rcompat/test";
import template from "#commands/output/template";
import feature from "#commands/output/feature";
import { CommandErrorCode } from "@saved/program";
import type { CodeError } from "@rcompat/error";

test.case("template command fails without subcommands", async assert => {
  let threw = false;
  let errorMessage: string | undefined;

  try {
    await template.run({
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

test.case("feature command fails without subcommands", async assert => {
  let threw = false;
  let errorMessage: string | undefined;

  try {
    await feature.run({
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

test.case("template command has create, apply, search, validate subcommands", async assert => {
  const subNames = [...template.subcommands.values()].map(s => s.name);
  assert(subNames.includes("create")).true();
  assert(subNames.includes("apply")).true();
  assert(subNames.includes("search")).true();
  assert(subNames.includes("validate")).true();
});

test.case("feature command has create, apply, search, validate subcommands", async assert => {
  const subNames = [...feature.subcommands.values()].map(s => s.name);
  assert(subNames.includes("create")).true();
  assert(subNames.includes("apply")).true();
  assert(subNames.includes("search")).true();
  assert(subNames.includes("validate")).true();
});