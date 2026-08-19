import test from "#test-utils/test/index";
import { resolveStepVariables } from "#utils/use/run-powerup/resolve-step-variables";
import type { Step } from "@liolocs/powerups-sdk";

test.case("returns variables unchanged when step has no variableMap", async assert => {
  const step = {
    type: "create",
    name: "create-component",
    template: "component.ts",
    outputPath: "src/{{name}}.ts",
  } as Step;

  const variables = { name: "foo" };

  const result = resolveStepVariables({ step, variables });

  assert(result).equals({ name: "foo" });
});

test.case("applies variableMap mappings, resolving template strings in values", async assert => {
  const step = {
    type: "create",
    name: "create-component",
    template: "component.ts",
    outputPath: "src/{{childName}}.ts",
    variableMap: { childName: "{{name}}" },
  } as Step;

  const variables = { name: "foo" };

  const result = resolveStepVariables({ step, variables });

  assert(result.childName).equals("foo");
  assert(result.name).equals("foo");
});

test.case("resolves variableMap values that reference multiple variables", async assert => {
  const step = {
    type: "create",
    name: "create-component",
    template: "component.ts",
    outputPath: "src/{{fullName}}.ts",
    variableMap: { fullName: "{{dir}}/{{name}}" },
  } as Step;

  const variables = { dir: "src", name: "foo" };

  const result = resolveStepVariables({ step, variables });

  assert(result.fullName).equals("src/foo");
});