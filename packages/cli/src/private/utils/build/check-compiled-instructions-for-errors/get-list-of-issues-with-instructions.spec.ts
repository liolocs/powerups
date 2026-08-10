import test from "#test-utils/test/index";
import { type Instructions } from "@liolocs/powerups-sdk";
import {
  getListOfIssuesWithInstructions,
  instruction_errors,
} from "#utils/build/check-compiled-instructions-for-errors/get-list-of-issues-with-instructions";

test.case("should have no issues with valid instructions", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{name}}.ts" },
      { type: "create", name: "spec", template: "spec.ts.ts", outputPath: "src/{{name}}.spec.ts" },
    ],
  };

  assert(await getListOfIssuesWithInstructions(instructions)).equals([]);
});

test.case("should flag when steps have same name", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{name}}.ts" },
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{name}}.ts" },
    ],
  };

  assert(await getListOfIssuesWithInstructions(instructions))
    .includes(instruction_errors.duplicate_step_name("comp"));
});

test.case("should flag when a variable is used before it is available", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{pkgName}}.ts" },
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
    ],
  };

  assert(await getListOfIssuesWithInstructions(instructions))
    .includes(instruction_errors.uses_template_variable_before_it_is_available("comp", "pkgName"));
});

test.case("should not flag when a read variable is registered correctly", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{pkgName}}.ts" },
    ],
  };

  assert((await getListOfIssuesWithInstructions(instructions)).length)
    .equals(0);
});

test.case("should have no errors when parent variable is mapped to child through variableMap", async assert => {
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

  assert((await getListOfIssuesWithInstructions(instructions)).length)
    .equals(0);
});

test.case("should flag when an unknown variable is used", async assert => {
  const unknownVariable = "random";
  const steps = [
    { type: "read", name: "pkg", path: "{{random}}.json", as: "pkgName", jsonPath: "name" },
    { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{random}}.ts" },
  ];

  for (const step of steps) {
    const instructions: Instructions = {
      name: "test-powerup",
      type: "multi-use",
      description: "a test powerup",
      variables: { required: ["name"], optional: [] },
      intent: [],
      steps: [step],
    };

    assert(await getListOfIssuesWithInstructions(instructions))
      .equals([instruction_errors.uses_template_variable_before_it_is_available(step.name, unknownVariable)]);
  }
});

test.case("should flag when an unknown variable is used in a variableMap", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{random}}" } }
    ],
  };

  assert(await getListOfIssuesWithInstructions(instructions))
    .equals([instruction_errors.uses_template_variable_before_it_is_available("child:component", "random")]);
});

test.case("should not flag when a variable is read before it is used in a variableMap", async assert => {
  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "a test powerup",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "read", name: "pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "create", name: "child:component", template: "_internal/child/templates/component.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{pkgName}}" } }
    ],
  };

  assert((await getListOfIssuesWithInstructions(instructions)).length)
    .equals(0);
});