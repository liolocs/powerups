import test from "@rcompat/test";
import { instructionsSchema, stepSchema, stepsSchema } from "#schema/instructions";

test.case("should parse instructions with create steps", async assert => {
  const result = instructionsSchema.parse({
    name: "simple",
    type: "single-use",
    description: "test description",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{componentName}}.ts" },
    ],
  });

  assert(result.steps.length).equals(1);
  assert(result.steps[0].type).equals("create");
  assert(result.steps[0].name).equals("comp");
  assert((result.steps[0] as any).template).equals("comp.ts.ts");
  assert((result.steps[0] as any).outputPath).equals("src/{{componentName}}.ts");
});

test.case("should parse instructions with modify steps", async assert => {
  const result = instructionsSchema.parse({
    name: "modify-test",
    type: "single-use",
    description: "test description",
    variables: { required: ["name"] },
    intent: [],
    steps: [
      { type: "modify", name: "wire", template: "wire.json", outputPath: "src/index.ts" },
    ],
  });

  assert(result.steps[0].type).equals("modify");
  assert((result.steps[0] as any).template).equals("wire.json");
});

test.case("should parse instructions with delete steps", async assert => {
  const result = instructionsSchema.parse({
    name: "cleanup",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "delete", name: "old-config", outputPath: "src/legacy/config.ts" },
      { type: "delete", name: "old-types", outputPath: "src/old/types.d.ts" },
    ],
  });

  assert(result.steps.length).equals(2);
  assert(result.steps[0].type).equals("delete");
  assert(result.steps[0].name).equals("old-config");
  assert((result.steps[0] as any).outputPath).equals("src/legacy/config.ts");
});

test.case("should parse instructions with read step (jsonPath mode)", async assert => {
  const result = instructionsSchema.parse({
    name: "read-test",
    type: "single-use",
    description: "test description",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
      { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "packages/{{packageName}}/src/{{componentName}}.ts" },
    ],
  });

  assert(result.steps[0].type).equals("read");
  assert((result.steps[0] as any).path).equals("package.json");
  assert((result.steps[0] as any).as).equals("packageName");
  assert((result.steps[0] as any).jsonPath).equals("name");
  assert((result.steps[0] as any).template).undefined();
});

test.case("should parse instructions with read step (template mode)", async assert => {
  const result = instructionsSchema.parse({
    name: "read-template-test",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "read", name: "read-version", path: "README.md", as: "version", template: "extract-version.ts.ts" },
    ],
  });

  assert((result.steps[0] as any).template).equals("extract-version.ts.ts");
  assert((result.steps[0] as any).jsonPath).undefined();
});

test.case("should parse instructions with read step (raw mode)", async assert => {
  const result = instructionsSchema.parse({
    name: "read-raw-test",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "read", name: "read-license", path: "LICENSE", as: "licenseText" },
    ],
  });

  assert((result.steps[0] as any).jsonPath).undefined();
  assert((result.steps[0] as any).template).undefined();
});

test.case("should parse instructions with include step", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    type: "single-use",
    description: "test description",
    variables: { required: ["theme"] },
    intent: [],
    steps: [
      { type: "include", name: "child", variables: { componentName: "Button", theme: "{{theme}}" } },
    ],
  });

  assert(result.steps[0].type).equals("include");
  assert(result.steps[0].name).equals("child");
  assert((result.steps[0] as any).variables.componentName).equals("Button");
  assert((result.steps[0] as any).variables.theme).equals("{{theme}}");
  assert((result.steps[0] as any).stepOverride).undefined();
  assert((result.steps[0] as any).excludeSteps).undefined();
});

test.case("should parse include step with stepOverride", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "include",
        name: "child",
        variables: { componentName: "Button" },
        stepOverride: {
          comp: { type: "create", template: "button.ts.ts", outputPath: "src/ui/{{componentName}}.tsx" },
        },
      },
    ],
  });

  const incStep0 = result.steps[0] as any;
  assert(incStep0.stepOverride).defined();
  assert(incStep0.stepOverride!.comp.type).equals("create");
  assert(incStep0.stepOverride!.comp.template).equals("button.ts.ts");
  assert(incStep0.stepOverride!.comp.outputPath).equals("src/ui/{{componentName}}.tsx");
});

test.case("should parse include step with excludeSteps", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "include",
        name: "child",
        variables: { componentName: "Button" },
        excludeSteps: ["old-config", "legacy-types"],
      },
    ],
  });

  const incStep1 = result.steps[0] as any;
  assert(incStep1.excludeSteps!.length).equals(2);
  assert(incStep1.excludeSteps![0]).equals("old-config");
});

test.case("should parse instructions with mixed step types in order", async assert => {
  const result = instructionsSchema.parse({
    name: "full",
    type: "single-use",
    description: "test description",
    variables: { required: ["name"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "pkgName", jsonPath: "name" },
      { type: "create", name: "c", template: "c.njk", outputPath: "src/{{name}}.ts" },
      { type: "modify", name: "m", template: "m.json", outputPath: "src/index.ts" },
      { type: "delete", name: "d", outputPath: "src/old.ts" },
      { type: "include", name: "child", variables: { val: "{{name}}" } },
    ],
  });

  assert(result.steps.length).equals(5);
  assert(result.steps[0].type).equals("read");
  assert(result.steps[1].type).equals("create");
  assert(result.steps[2].type).equals("modify");
  assert(result.steps[3].type).equals("delete");
  assert(result.steps[4].type).equals("include");
});

test.case("should parse instructions with empty steps array", async assert => {
  const result = instructionsSchema.parse({
    name: "empty",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [],
  });

  assert(result.steps.length).equals(0);
});

test.case("should parse instructions with packageDependencies", async assert => {
  const result = instructionsSchema.parse({
    name: "add-tailwind",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: ["tailwind"],
    packageDependencies: [
      { target: "packages/web", dependencies: ["tailwindcss@^4.0.0"] },
    ],
    steps: [],
  });

  assert(result.packageDependencies).defined();
  assert(result.packageDependencies!.length).equals(1);
  assert(result.packageDependencies![0].target).equals("packages/web");
});

test.case("should parse instructions with required and optional variables", async assert => {
  const result = instructionsSchema.parse({
    name: "cli-command",
    type: "single-use",
    description: "test description",
    variables: { required: ["name", "description"], optional: ["sub", "subDescription"] },
    intent: [],
    steps: [],
  });

  assert(result.variables.required).equals(["name", "description"]);
  assert(result.variables.optional).equals(["sub", "subDescription"]);
});

test.case("should parse instructions with required only (optional omitted)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple",
    type: "single-use",
    description: "test description",
    variables: { required: ["name"] },
    intent: [],
    steps: [],
  });

  assert(result.variables.required).equals(["name"]);
  assert(result.variables.optional).undefined();
});

test.case("should parse instructions with empty required and some optional", async assert => {
  const result = instructionsSchema.parse({
    name: "opt-only",
    type: "single-use",
    description: "test description",
    variables: { required: [], optional: ["sub"] },
    intent: [],
    steps: [],
  });

  assert(result.variables.required).equals([]);
  assert(result.variables.optional).equals(["sub"]);
});

test.case("should parse description field", async assert => {
  const result = instructionsSchema.parse({
    name: "with-description",
    type: "single-use",
    description: "A template that does something useful.",
    variables: { required: [] },
    intent: [],
    steps: [],
  });

  assert(result.description).equals("A template that does something useful.");
});

test.case("should parse multiple packageDependencies groups", async assert => {
  const result = instructionsSchema.parse({
    name: "multi-dep",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    packageDependencies: [
      { target: "packages/web", dependencies: ["react@^18.0.0"] },
      { target: "packages/api", dependencies: ["express@^4.0.0"] },
      { dependencies: ["shared-dep@^1.0.0"] },
    ],
    steps: [],
  });

  assert(result.packageDependencies!.length).equals(3);
  assert(result.packageDependencies![0].target).equals("packages/web");
  assert(result.packageDependencies![1].target).equals("packages/api");
  assert(result.packageDependencies![2].target).undefined();
});

test.case("should parse instructions without packageDependencies", async assert => {
  const result = instructionsSchema.parse({
    name: "no-deps",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [],
  });

  assert(result.packageDependencies).undefined();
});

test.case("should parse include step with both stepOverride and excludeSteps", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    type: "single-use",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "include",
        name: "child",
        variables: { componentName: "Button" },
        stepOverride: {
          comp: { type: "create", template: "button.ts.ts", outputPath: "src/ui/{{componentName}}.tsx" },
        },
        excludeSteps: ["old-config"],
      },
    ],
  });

  const includeStep = result.steps[0] as any;
  assert(includeStep.type).equals("include");
  assert(includeStep.stepOverride).defined();
  assert(includeStep.stepOverride!.comp.outputPath).equals("src/ui/{{componentName}}.tsx");
  assert(includeStep.excludeSteps!.length).equals(1);
  assert(includeStep.excludeSteps![0]).equals("old-config");
});

test.case("stepSchema should parse a create step", async assert => {
  const result = stepSchema.parse({ type: "create", name: "c", template: "c.njk", outputPath: "src/x.ts" });

  assert(result.type).equals("create");
  assert(result.name).equals("c");
});

test.case("stepSchema should parse a read step", async assert => {
  const result = stepSchema.parse({ type: "read", name: "r", path: "package.json", as: "pkgName", jsonPath: "name" }) as { type: string; as: string };

  assert(result.type).equals("read");
  assert(result.as).equals("pkgName");
});

test.case("stepsSchema should parse an array of steps", async assert => {
  const result = stepsSchema.parse([
    { type: "create", name: "a", template: "a.njk", outputPath: "src/a.ts" },
    { type: "delete", name: "b", outputPath: "src/b.ts" },
  ]);

  assert(result.length).equals(2);
  assert(result[0].type).equals("create");
  assert(result[1].type).equals("delete");
});

test.group("instruction schema rejections", () => {
  test.case("should reject instructions missing steps", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a create step missing name", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "create", template: "c.ts", outputPath: "src/x.ts" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a read step missing as", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "read", name: "r", path: "package.json" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject an include step missing variables", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "include", name: "child" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject instructions missing description", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "no-description",
        type: "single-use",
        variables: { required: [] },
        intent: [],
        steps: [],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject instructions with non-string description", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad-description",
        type: "single-use",
        description: 123,
        variables: { required: [] },
        intent: [],
        steps: [],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject old output format", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        output: { create: [], modify: [] },
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  // Note: pema default mode strips unknown keys silently, so passing
  // `includes` alongside `steps` does not cause a rejection. The old
  // `output` format IS rejected because `steps` is required and missing.

  test.case("should reject packageDependencies with non-string dependency", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        packageDependencies: [
          { dependencies: [123] },
        ],
        steps: [],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject old array format for variables", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: ["name"],
        intent: [],
        steps: [],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a delete step missing outputPath", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "delete", name: "x" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a create step missing template", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "create", name: "c", outputPath: "src/x.ts" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a modify step missing outputPath", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "modify", name: "m", template: "m.json" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a read step missing path", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "read", name: "r", as: "val" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject an include step missing name", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "include", variables: {} }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject an unknown step type", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        type: "single-use",
        description: "test description",
        variables: { required: [] },
        intent: [],
        steps: [{ type: "unknown", name: "x" }],
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });
});