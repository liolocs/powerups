import test from "@rcompat/test";
import { instructionsSchema } from "#schemas/instruction";

test.case("parses instructions with includes", async assert => {
  const result = instructionsSchema.parse({
    name: "shadcn-all-components",
    variables: ["theme"],
    intent: ["shadcn"],
    output: { files: [] },
    includes: [
      {
        name: "shadcn-button-component",
        variables: { componentName: "Button", theme: "{{theme}}" },
        files: { component: "src/ui/{{componentName}}.tsx" },
      },
    ],
  });

  assert(result.includes).defined();
  assert(result.includes!.length).equals(1);
  assert(result.includes![0].name).equals("shadcn-button-component");
  assert(result.includes![0].variables.componentName).equals("Button");
  assert(result.includes![0].variables.theme).equals("{{theme}}");
  assert(result.includes![0].files).defined();
  assert(result.includes![0].files!.component).equals("src/ui/{{componentName}}.tsx");
});

test.case("parses instructions without includes (backward compat)", async assert => {
  const result = instructionsSchema.parse({
    name: "simple-output",
    variables: ["ComponentName"],
    intent: [],
    output: { files: [] },
  });

  assert(result.name).equals("simple-output");
  assert(result.includes).undefined();
});

test.case("parses includes without optional files override", async assert => {
  const result = instructionsSchema.parse({
    name: "parent",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [
      {
        name: "child",
        variables: { componentName: "Button" },
      },
    ],
  });

  assert(result.includes![0].files).undefined();
});

test.case("rejects includes entry missing name", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "parent",
      variables: [],
      intent: [],
      output: { files: [] },
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
      output: { files: [] },
      includes: [{ name: "child" }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});