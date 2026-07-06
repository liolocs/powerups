import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolveOutput, type RenderTask } from "#utils/resolve";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const outputsFolder: FileRef = mainFolder.append(`/${OUTPUTS_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(outputsFolder);
}

async function writeOutput(name: string, instructions: Record<string, unknown>) {
  const dir = outputsFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("leaf output produces one task per output file", async assert => {
  await reset();
  await writeOutput("leaf", {
    name: "leaf",
    variables: ["componentName"],
    intent: [],
    output: {
      files: [
        { name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" },
        { name: "test", template: "test.njk", outputPath: "src/{{componentName}}.spec.ts" },
      ],
    },
  });

  const tasks = await resolveOutput({
    outputName: "leaf",
    variables: { componentName: "Button" },
    outputsFolder,
  });

  assert(tasks.length).equals(2);
  assert(tasks[0].outputPath).equals("src/{{componentName}}.ts");
  assert(tasks[0].variables.componentName).equals("Button");
  assert(tasks[1].outputPath).equals("src/{{componentName}}.spec.ts");
  await testRoot.remove();
});

test.case("output with includes produces own tasks plus suboutput tasks", async assert => {
  await reset();
  await writeOutput("child", {
    name: "child",
    variables: ["componentName", "theme"],
    intent: [],
    output: {
      files: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
    },
  });
  await writeOutput("parent", {
    name: "parent",
    variables: ["theme"],
    intent: [],
    output: {
      files: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
    },
    includes: [
      {
        name: "child",
        variables: { componentName: "Button", theme: "{{theme}}" },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "parent",
    variables: { theme: "dark" },
    outputsFolder,
  });

  assert(tasks.length).equals(2);
  // Parent's own task first
  assert(tasks[0].outputPath).equals("src/index.ts");
  assert(tasks[0].variables.theme).equals("dark");
  // Suboutput task second
  assert(tasks[1].outputPath).equals("src/{{componentName}}.tsx");
  assert(tasks[1].variables.componentName).equals("Button");
  assert(tasks[1].variables.theme).equals("dark");
  await testRoot.remove();
});

test.case("nested suboutputs (A->B->C) produce flat list of all tasks", async assert => {
  await reset();
  await writeOutput("nest-c", {
    name: "nest-c",
    variables: ["val"],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "c.ts" }] },
  });
  await writeOutput("nest-b", {
    name: "nest-b",
    variables: ["val"],
    intent: [],
    output: { files: [{ name: "f", template: "b.njk", outputPath: "b.ts" }] },
    includes: [{ name: "nest-c", variables: { val: "{{val}}" } }],
  });
  await writeOutput("nest-a", {
    name: "nest-a",
    variables: ["val"],
    intent: [],
    output: { files: [{ name: "f", template: "a.njk", outputPath: "a.ts" }] },
    includes: [{ name: "nest-b", variables: { val: "{{val}}" } }],
  });

  const tasks = await resolveOutput({
    outputName: "nest-a",
    variables: { val: "test" },
    outputsFolder,
  });

  assert(tasks.length).equals(3);
  assert(tasks[0].outputPath).equals("a.ts");
  assert(tasks[1].outputPath).equals("b.ts");
  assert(tasks[2].outputPath).equals("c.ts");
  // Variable flows through all levels
  assert(tasks[2].variables.val).equals("test");
  await testRoot.remove();
});

test.case("variable mapping passes static value through", async assert => {
  await reset();
  await writeOutput("static-child", {
    name: "static-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "out.ts" }] },
  });
  await writeOutput("static-parent", {
    name: "static-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "static-child", variables: { componentName: "Button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "static-parent",
    variables: {},
    outputsFolder,
  });

  assert(tasks[0].variables.componentName).equals("Button");
  await testRoot.remove();
});

test.case("variable mapping resolves parentVar reference", async assert => {
  await reset();
  await writeOutput("ref-child", {
    name: "ref-child",
    variables: ["theme"],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "out.ts" }] },
  });
  await writeOutput("ref-parent", {
    name: "ref-parent",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "ref-child", variables: { theme: "{{theme}}" } }],
  });

  const tasks = await resolveOutput({
    outputName: "ref-parent",
    variables: { theme: "dark" },
    outputsFolder,
  });

  assert(tasks[0].variables.theme).equals("dark");
  await testRoot.remove();
});

test.case("variable mapping resolves mixed text and tokens", async assert => {
  await reset();
  await writeOutput("mixed-child", {
    name: "mixed-child",
    variables: ["variant"],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "out.ts" }] },
  });
  await writeOutput("mixed-parent", {
    name: "mixed-parent",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "mixed-child", variables: { variant: "{{theme}}-button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "mixed-parent",
    variables: { theme: "dark" },
    outputsFolder,
  });

  assert(tasks[0].variables.variant).equals("dark-button");
  await testRoot.remove();
});

test.case("output path override applied to correct file by name", async assert => {
  await reset();
  await writeOutput("override-child", {
    name: "override-child",
    variables: ["componentName"],
    intent: [],
    output: {
      files: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
    },
  });
  await writeOutput("override-parent", {
    name: "override-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      {
        name: "override-child",
        variables: { componentName: "Button" },
        files: { comp: "src/ui/{{componentName}}.tsx" },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "override-parent",
    variables: {},
    outputsFolder,
  });

  assert(tasks[0].outputPath).equals("src/ui/{{componentName}}.tsx");
  await testRoot.remove();
});

test.case("no override preserves original outputPath", async assert => {
  await reset();
  await writeOutput("no-override-child", {
    name: "no-override-child",
    variables: ["componentName"],
    intent: [],
    output: {
      files: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
    },
  });
  await writeOutput("no-override-parent", {
    name: "no-override-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "no-override-child", variables: { componentName: "Button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "no-override-parent",
    variables: {},
    outputsFolder,
  });

  assert(tasks[0].outputPath).equals("src/{{componentName}}.tsx");
  await testRoot.remove();
});

test.case("same suboutput referenced twice with different variables produces distinct tasks", async assert => {
  await reset();
  await writeOutput("dual-child", {
    name: "dual-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }] },
  });
  await writeOutput("dual-parent", {
    name: "dual-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "dual-child", variables: { componentName: "Primary" } },
      { name: "dual-child", variables: { componentName: "Secondary" } },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "dual-parent",
    variables: {},
    outputsFolder,
  });

  assert(tasks.length).equals(2);
  assert(tasks[0].variables.componentName).equals("Primary");
  assert(tasks[1].variables.componentName).equals("Secondary");
  await testRoot.remove();
});

test.case("overrides do not cascade to nested suboutputs", async assert => {
  await reset();
  await writeOutput("cascade-grandchild", {
    name: "cascade-grandchild",
    variables: [],
    intent: [],
    output: { files: [{ name: "f", template: "g.njk", outputPath: "original.ts" }] },
  });
  await writeOutput("cascade-child", {
    name: "cascade-child",
    variables: [],
    intent: [],
    output: { files: [{ name: "f", template: "c.njk", outputPath: "original.ts" }] },
    includes: [{ name: "cascade-grandchild", variables: {} }],
  });
  await writeOutput("cascade-parent", {
    name: "cascade-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      {
        name: "cascade-child",
        variables: {},
        files: { f: "overridden.ts" },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "cascade-parent",
    variables: {},
    outputsFolder,
  });

  // Child's file is overridden
  assert(tasks[0].outputPath).equals("overridden.ts");
  // Grandchild's file is NOT overridden (override doesn't cascade)
  assert(tasks[1].outputPath).equals("original.ts");
  await testRoot.remove();
});