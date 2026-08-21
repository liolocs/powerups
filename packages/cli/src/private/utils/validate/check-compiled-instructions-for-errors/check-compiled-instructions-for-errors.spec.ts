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
      { type: "create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } }
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
      { type: "create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } }
    ],
  };

  assert(checkCompiledInstructionsForErrors(instructions)).throwsAsync(BuildErrorCode.malformed_instructions);
});