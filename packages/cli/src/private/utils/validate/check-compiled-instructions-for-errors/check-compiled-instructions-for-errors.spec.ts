// import runtime from "@rcompat/runtime";
// import fs from "@rcompat/fs";

import test from "#test-utils/test/index";
import { type Instructions } from "@liolocs/powerups-sdk";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import { BuildErrorCode } from "#errors/buildErrors";

test.case("should not have any issues with valid instructions", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "dynamic-create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } }
    ],
  };

  assert(checkCompiledInstructionsForErrors(instructions)).noErrorAsync();
});

test.case("should flag if instructions have a schema issue", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    // @ts-expect-error made this error on purpose for the test
    type: "incorrect-type",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "dynamic-create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } }
    ],
  };

  assert(checkCompiledInstructionsForErrors(instructions)).throwsAsync(BuildErrorCode.malformed_instructions);
});

test.case("old-format create-with-template instructions throw old_format_instructions", async assert => {
  const oldFormatInstructions = {
    name: "old-powerup",
    type: "single-use",
    description: "old format",
    variables: { required: [], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "x", template: "templates/x.ts", outputPath: "x.txt" },
    ],
  };

  try {
    await checkCompiledInstructionsForErrors(oldFormatInstructions as never);
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("old_format_instructions");
  }
});

test.case("dynamic-create steps pass validation and are returned", async assert => {
  const instructions = {
    name: "new-powerup",
    type: "single-use",
    description: "new format",
    variables: { required: [], optional: [] },
    intent: [],
    steps: [
      { type: "dynamic-create", name: "x", template: "src/dynamic-create/x.ts", outputPath: "x.txt" },
      { type: "create", name: "y", file: "src/create/y.txt", outputPath: "y.txt" },
    ],
  };

  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions as never);
  assert(validatedCompiledInstructions.steps.length).equals(2);
});