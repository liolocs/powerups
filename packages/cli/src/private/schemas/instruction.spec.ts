import test from "@rcompat/test";
import { instructionsSchema } from "#schemas/instruction";

test.case("should parse instructions with includes", async assert => {
  const result = instructionsSchema.parse({
    name: "shadcn-all-components",
    variables: { required: ["theme"] },
    intent: ["shadcn"],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "shadcn-button-component",
        variables: { componentName: "Button", theme: "{{theme}}" },
        outputPathOverride: { create: { component: "src/ui/{{componentName}}.tsx" } },
      },
    ],
  });

  assert(result.includes).defined();
  assert(result.includes!.length).equals(1);
  assert(result.includes![0].name).equals("shadcn-button-component");
  assert(result.includes![0].variables.componentName).equals("Button");
  assert(result.includes![0].variables.theme).equals("{{theme}}");
  assert(result.includes![0].outputPathOverride).defined();
  assert(result.includes![0].outputPathOverride!.create!.component).equals("src/ui/{{componentName}}.tsx");
});

test.case("should parse instructions without includes (backward compat)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple-output",
    variables: { required: ["ComponentName"] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.name).equals("simple-output");
  assert(result.includes).undefined();
});

test.case("should parse includes without optional outputPathOverride", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: { required: ["theme"] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "child",
        variables: { componentName: "Button" },
      },
    ],
  });

  assert(result.includes![0].outputPathOverride).undefined();
});

test.case("should parse includes with both create and modify outputPathOverride", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: { required: ["theme"] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "child",
        variables: { componentName: "Button" },
        outputPathOverride: {
          create: { comp: "src/ui/{{componentName}}.tsx" },
          modify: { wire: "src/index.ts" },
        },
      },
    ],
  });

  assert(result.includes![0].outputPathOverride!.create!.comp).equals("src/ui/{{componentName}}.tsx");
  assert(result.includes![0].outputPathOverride!.modify!.wire).equals("src/index.ts");
});

test.case("should parse output with both create and modify entries", async assert => {
  const result = instructionsSchema.parse({
    name: "api",
    variables: { required: ["name"] },
    intent: ["create a new backend api"],
    output: {
      create: [
        { name: "controller", template: "controller.ts", outputPath: "src/controllers/{{name}}.ts" },
      ],
      modify: [
        { name: "wire", template: "wire.json", outputPath: "src/controllers/index.ts" },
      ],
    },
  });

  assert(result.output.create.length).equals(1);
  assert(result.output.modify.length).equals(1);
  assert(result.output.create[0].name).equals("controller");
  assert(result.output.modify[0].name).equals("wire");
});

test.case("should parse output with a delete array", async assert => {
  const result = instructionsSchema.parse({
    name: "cleanup",
    variables: { required: [] },
    intent: [],
    output: {
      create: [],
      modify: [],
      delete: [
        { name: "legacy-config", outputPath: "src/legacy/config.ts" },
        { name: "old-types", outputPath: "src/old/types.d.ts" },
      ],
    },
  });

  assert(result.output.delete).defined();
  assert(result.output.delete!.length).equals(2);
  assert(result.output.delete![0].name).equals("legacy-config");
  assert(result.output.delete![0].outputPath).equals("src/legacy/config.ts");
  assert(result.output.delete![1].name).equals("old-types");
});

test.case("should parse output without delete (backward compat)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.output.delete).undefined();
});

test.case("should parse packageDependencies with target (monorepo)", async assert => {
  const result = instructionsSchema.parse({
    name: "add-tailwind",
    variables: { required: [] },
    intent: ["tailwind"],
    packageDependencies: [
      {
        target: "packages/web",
        dependencies: ["tailwindcss@^4.0.0"],
        devDependencies: ["@types/tailwindcss@^3.0.0"],
      },
    ],
    output: { create: [], modify: [] },
  });

  assert(result.packageDependencies).defined();
  assert(result.packageDependencies!.length).equals(1);
  assert(result.packageDependencies![0].target).equals("packages/web");
  assert(result.packageDependencies![0].dependencies!.length).equals(1);
  assert(result.packageDependencies![0].dependencies![0]).equals("tailwindcss@^4.0.0");
  assert(result.packageDependencies![0].devDependencies!.length).equals(1);
  assert(result.packageDependencies![0].devDependencies![0]).equals("@types/tailwindcss@^3.0.0");
  assert(result.packageDependencies![0].peerDependencies).undefined();
});

test.case("should parse packageDependencies without target (normal repo)", async assert => {
  const result = instructionsSchema.parse({
    name: "add-dep",
    variables: { required: [] },
    intent: [],
    packageDependencies: [
      {
        dependencies: ["some-pkg@^1.0.0"],
      },
    ],
    output: { create: [], modify: [] },
  });

  assert(result.packageDependencies).defined();
  assert(result.packageDependencies!.length).equals(1);
  assert(result.packageDependencies![0].target).undefined();
  assert(result.packageDependencies![0].dependencies![0]).equals("some-pkg@^1.0.0");
});

test.case("should parse multiple packageDependencies groups", async assert => {
  const result = instructionsSchema.parse({
    name: "multi-dep",
    variables: { required: [] },
    intent: [],
    packageDependencies: [
      { target: "packages/web", dependencies: ["react@^18.0.0"] },
      { target: "packages/api", dependencies: ["express@^4.0.0"] },
      { dependencies: ["shared-dep@^1.0.0"] },
    ],
    output: { create: [], modify: [] },
  });

  assert(result.packageDependencies!.length).equals(3);
  assert(result.packageDependencies![0].target).equals("packages/web");
  assert(result.packageDependencies![1].target).equals("packages/api");
  assert(result.packageDependencies![2].target).undefined();
});

test.case("should parse instructions without packageDependencies (backward compat)", async assert => {
  const result = instructionsSchema.parse({
    name: "no-deps",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.packageDependencies).undefined();
});

test.case("should parse includes with outputPathOverride.delete", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "child",
        variables: {},
        outputPathOverride: {
          delete: { "legacy-file": "src/legacy/file.ts" },
        },
      },
    ],
  });

  assert(result.includes![0].outputPathOverride!.delete!.legacyFile).undefined();
  assert(result.includes![0].outputPathOverride!.delete!["legacy-file"]).equals("src/legacy/file.ts");
});

test.case("should parse output with create, modify, and delete together", async assert => {
  const result = instructionsSchema.parse({
    name: "full",
    variables: { required: ["name"] },
    intent: [],
    output: {
      create: [{ name: "c", template: "c.njk", outputPath: "src/{{name}}.ts" }],
      modify: [{ name: "m", template: "m.json", outputPath: "src/index.ts" }],
      delete: [{ name: "d", outputPath: "src/old.ts" }],
    },
  });

  assert(result.output.create.length).equals(1);
  assert(result.output.modify.length).equals(1);
  assert(result.output.delete!.length).equals(1);
});

test.group("instruction schema rejections", () => {
  test.case("should reject an includes entry missing name", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "parent",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ variables: {} }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

  test.case("should reject an includes entry missing variables", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "parent",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "child" }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

  test.case("should reject output missing create array", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: { required: [] },
      intent: [],
      output: { modify: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

  test.case("should reject output missing modify array", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: { required: [] },
      intent: [],
      output: { create: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
  });

  test.case("should reject a delete entry missing name", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        variables: { required: [] },
        intent: [],
        output: { create: [], modify: [], delete: [{ outputPath: "src/x.ts" }] },
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject a delete entry missing outputPath", async assert => {
    let threw = false;
    try {
      instructionsSchema.parse({
        name: "bad",
        variables: { required: [] },
        intent: [],
        output: { create: [], modify: [], delete: [{ name: "x" }] },
      });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("should reject packageDependencies with non-string dependency", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: { required: [] },
      intent: [],
      packageDependencies: [
        { dependencies: [123] },
      ],
      output: { create: [], modify: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});
});
test.case("should parse instructions with required and optional variables", async assert => {
  const result = instructionsSchema.parse({
    name: "cli-command",
    variables: { required: ["name", "description"], optional: ["sub", "subDescription"] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.variables.required).equals(["name", "description"]);
  assert(result.variables.optional).equals(["sub", "subDescription"]);
});

test.case("should parse instructions with required only (optional omitted)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple",
    variables: { required: ["name"] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.variables.required).equals(["name"]);
  assert(result.variables.optional).undefined();
});

test.case("should parse instructions with empty required and some optional", async assert => {
  const result = instructionsSchema.parse({
    name: "opt-only",
    variables: { required: [], optional: ["sub"] },
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.variables.required).equals([]);
  assert(result.variables.optional).equals(["sub"]);
});

test.case("should reject old array format for variables", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: ["name"],
      intent: [],
      output: { create: [], modify: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});
