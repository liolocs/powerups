import test from "@rcompat/test";
import testCmdList from "#commands/test-cmd/list";
import { TestCmdErrorCode } from "#errors/test-cmdErrors";
import { CodeError } from "@rcompat/error";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("list has correct name and description", async assert => {
  assert(testCmdList.name).equals("list");
  assert(testCmdList.description).equals("List items");
});

test.group("list errors", () => {
  test.case("should throw invalid_format", async assert => {
    // TODO: set up test conditions that trigger this error
    let threw;
    try {
      await testCmdList.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(TestCmdErrorCode.invalid_format);
  });
});
