import test from "@rcompat/test";
import testCmd from "#commands/test-cmd/index";
import { TestCmdErrorCode } from "#errors/test-cmdErrors";
import { CodeError } from "@rcompat/error";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("test-cmd has correct name and description", async assert => {
  assert(testCmd.name).equals("test-cmd");
  assert(testCmd.description).equals("Test command");
});

test.group("test-cmd errors", () => {
  test.case("should throw missing_arg", async assert => {
    // TODO: set up test conditions that trigger this error
    let threw;
    try {
      await testCmd.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(TestCmdErrorCode.missing_arg);
  });
});
