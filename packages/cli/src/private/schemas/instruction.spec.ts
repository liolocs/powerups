import test from "@rcompat/test";
import { instructionsSchema } from "#schemas/instruction";

test.case("parses instructions with includes", async assert => {
  const result = instructionsSchema.parse({
    name: "shadcn-all-components",
    variables: ["theme"],
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

test.case("parses instructions without includes (backward compat)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple-output",
    variables: ["ComponentName"],
    intent: [],
    output: { create: [], modify: [] },
  });

  assert(result.name).equals("simple-output");
  assert(result.includes).undefined();
});

test.case("parses includes without optional outputPathOverride", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: ["theme"],
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

test.case("parses includes with both create and modify outputPathOverride", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: ["theme"],
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

test.case("parses output with both create and modify entries", async assert => {
  const result = instructionsSchema.parse({
    name: "api",
    variables: ["name"],
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

test.case("rejects includes entry missing name", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ variables: {} }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects includes entry missing variables", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "child" }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects output missing create array", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: [],
      intent: [],
      output: { modify: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects output missing modify array", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "bad",
      variables: [],
      intent: [],
      output: { create: [] },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});