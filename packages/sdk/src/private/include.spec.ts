import test from "@rcompat/test";
import { defineInstructions, includePowerup } from "#include";
import type { Instructions } from "#schema/instructions";

const childInstructions: Instructions = {
  name: "child",
  type: "multi-use",
  description: "child",
  variables: { required: ["commandName"], optional: ["flags"] },
  intent: [],
  steps: [
    {
      type: "dynamic-create",
      name: "command",
      template: "templates/command.ts",
      outputPath: "src/{{commandName}}.ts",
    },
    {
      type: "dynamic-create",
      name: "spec",
      template: "templates/spec.ts",
      outputPath: "src/{{commandName}}.spec.ts",
    },
  ],
};

test.case("defineInstructions wraps instructions and source", async assert => {
  const out = defineInstructions(childInstructions, "file:///child/dist/index.js");

  assert(out.instructions).defined();
  assert(out.source).equals("file:///child/dist/index.js");
});

test.case("includePowerup prefixes templates, renames steps, attaches maps", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}", flags: "[]" },
  });

  assert(steps.length).equals(2);
  assert(steps[0].name).equals("child:command");
  assert((steps[0] as any).template).equals("_internal/child/templates/command.ts");
  assert((steps[0] as any).variableMap.commandName).equals("{{name}}");
  assert((steps[0] as any).__source).equals("file:///child/dist/index.js");
  assert((steps[0] as any).from.name).equals("child");
  assert((steps[0] as any).from.singleUse).equals(false);
});

test.case("includePowerup honors excludeSteps", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}" },
    excludeSteps: ["spec"],
  });

  assert(steps.length).equals(1);
  assert(steps[0].name).equals("child:command");
});

test.case("includePowerup applies stepOverride", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}" },
    stepOverride: {
      command: { type: "dynamic-create", template: "templates/other.ts", outputPath: "src/{{commandName}}.ts" },
    },
  });

  assert((steps[0] as any).template).equals("_internal/child/templates/other.ts");
});

test.case("includePowerup uses explicit namespace", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    namespace: "alias",
    variables: { commandName: "{{name}}" },
  });

  assert(steps[0].name).equals("alias:command");
  assert((steps[0] as any).template).equals("_internal/alias/templates/command.ts");
});

test.case("includePowerup marks single-use children", async assert => {
  const singleUseChild: Instructions = {
    name: "once",
    type: "single-use",
    description: "once",
    variables: { required: ["x"] },
    intent: [],
    steps: [
      { type: "dynamic-create", name: "s", template: "templates/s.ts", outputPath: "src/{{x}}.ts" },
    ],
  };
  const child = defineInstructions(singleUseChild, "file:///once/dist/index.js");
  const steps = includePowerup(child, { variables: { x: "{{name}}" } });

  assert((steps[0] as any).from.singleUse).true();
});

const childWithStaticSteps: Instructions = {
  name: "static-child",
  type: "multi-use",
  description: "static child",
  variables: { required: [], optional: [] },
  intent: [],
  steps: [
    {
      type: "create",
      name: "static-note",
      file: "src/create/note.txt",
      outputPath: "note.txt",
    },
    {
      type: "modify",
      name: "static-patch",
      file: "src/modify/pkg.json.json",
      outputPath: "package.json",
    },
    {
      type: "dynamic-create",
      name: "dyn",
      template: "src/dynamic-create/dyn.ts",
      outputPath: "dyn.txt",
    },
  ],
};

const childWithTransitiveStaticSteps: Instructions = {
  name: "transitive-child",
  type: "multi-use",
  description: "transitive child",
  variables: { required: [], optional: [] },
  intent: [],
  steps: [
    {
      type: "create",
      name: "nested",
      file: "_internal/grandchild/src/create/nested.txt",
      outputPath: "nested.txt",
      __source: "file:///grandchild/dist/index.js",
      from: { name: "grandchild", singleUse: false },
    },
  ],
};

test.case("includePowerup prefixes static file fields of included steps", async assert => {
  const child = defineInstructions(childWithStaticSteps, "file:///static-child/dist/index.js");
  const steps = includePowerup(child, { variables: {} });

  const createStep = steps.find(step => step.name === "static-child:static-note") as any;
  assert(createStep.file).equals("_internal/static-child/src/create/note.txt");

  const modifyStep = steps.find(step => step.name === "static-child:static-patch") as any;
  assert(modifyStep.file).equals("_internal/static-child/src/modify/pkg.json.json");
});

test.case("includePowerup leaves already-internal file paths untouched", async assert => {
  const child = defineInstructions(childWithTransitiveStaticSteps, "file:///transitive-child/dist/index.js");
  const steps = includePowerup(child, { variables: {} });

  const createStep = steps.find(step => step.name === "transitive-child:nested") as any;
  assert(createStep.file).equals("_internal/grandchild/src/create/nested.txt");
});

test.case("includePowerup keeps template prefixing behavior alongside file prefixing", async assert => {
  const child = defineInstructions(childWithStaticSteps, "file:///static-child/dist/index.js");
  const steps = includePowerup(child, { variables: {} });

  const dynamicStep = steps.find(step => step.name === "static-child:dyn") as any;
  assert(dynamicStep.template).equals("_internal/static-child/src/dynamic-create/dyn.ts");
});

test.case("includePowerup composes variableMap for transitive includes", async assert => {
  // simulate a step that already carries a variableMap (as a transitive child would)
  const transitiveInstructions: Instructions = {
    name: "grand",
    type: "multi-use",
    description: "grand",
    variables: { required: ["grandName"] },
    intent: [],
    steps: [
      {
        type: "dynamic-create",
        name: "g",
        template: "_internal/grand/templates/g.ts",
        outputPath: "src/{{grandName}}.ts",
        variableMap: { grandName: "{{commandName}}" },
        __source: "file:///grand/dist/index.js",
        from: { name: "grand", singleUse: false },
      },
    ],
  };
  const child = defineInstructions(transitiveInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    namespace: "child",
    variables: { commandName: "{{name}}" },
  });
  // parent map first, child's existing map second
  const map = (steps[0] as any).variableMap;

  assert(Object.keys(map)[0]).equals("commandName");
  assert(Object.keys(map)[1]).equals("grandName");
  assert(map.grandName).equals("{{commandName}}");
  // transitive template already starts with _internal/ — not re-prefixed
  assert((steps[0] as any).template).equals("_internal/grand/templates/g.ts");
  // __source retained from the grandchild step
  assert((steps[0] as any).__source).equals("file:///grand/dist/index.js");
});

