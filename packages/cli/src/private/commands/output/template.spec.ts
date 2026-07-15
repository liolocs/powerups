import test from "@rcompat/test";
import template from "#commands/output/template";
import feature from "#commands/output/feature";
import { CommandErrorCode } from "@saved/program";
import { CodeError } from "@rcompat/error";

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

test.group("template/feature command errors", () => {
  test.case("should fail with missing_required_subcommand when template runs without subcommands", async assert => {
    let threw;

    try {
      await template.run({
        subcommands: [],
        flags: [],
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();

      threw = (e as CodeError).code;
    }

    assert(threw).equals(CommandErrorCode.missing_required_subcommand);
  });

  test.case("should fail with missing_required_subcommand when feature runs without subcommands", async assert => {
    let threw;

    try {
      await feature.run({
        subcommands: [],
        flags: [],
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();

      threw = (e as CodeError).code;
    }

    assert(threw).equals(CommandErrorCode.missing_required_subcommand);
  });
});