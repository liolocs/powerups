import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolveOutput, type RenderTask } from "#utils/resolve";
import { MAIN_FOLDER, OUTPUT_FOLDER, TEMPLATE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const templateFolder: FileRef = mainFolder.append(`/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(templateFolder);
}

async function writeOutput(name: string, instructions: Record<string, unknown>) {
  const dir = templateFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("should produce one task per create file for a leaf output", async assert => {
  await reset();
  await writeOutput("leaf", {
    name: "leaf",
    variables: ["componentName"],
    intent: [],
    output: {
      create: [
        { name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" },
        { name: "test", template: "test.njk", outputPath: "src/{{componentName}}.spec.ts" },
      ],
      modify: [],
    },
  });

  const tasks = await resolveOutput({
    outputName: "leaf",
    variables: { componentName: "Button" },
    outputsFolder: templateFolder,
  });

  assert(tasks.length).equals(2);
  assert(tasks[0].kind).equals("create");
  assert(tasks[0].outputPath).equals("src/{{componentName}}.ts");
  assert(tasks[0].variables.componentName).equals("Button");
  assert(tasks[1].outputPath).equals("src/{{componentName}}.spec.ts");
  await testRoot.remove();
});

test.case("should produce tasks with correct kind for output with both create and modify", async assert => {
  await reset();
  await writeOutput("both", {
    name: "both",
    variables: ["name"],
    intent: [],
    output: {
      create: [{ name: "controller", template: "c.ts", outputPath: "src/{{name}}.ts" }],
      modify: [{ name: "wire", template: "w.json", outputPath: "src/index.ts" }],
    },
  });

  const tasks = await resolveOutput({
    outputName: "both",
    variables: { name: "User" },
    outputsFolder: templateFolder,
  });

  assert(tasks.length).equals(2);
  assert(tasks[0].kind).equals("create");
  assert(tasks[0].outputPath).equals("src/{{name}}.ts");
  assert(tasks[1].kind).equals("modify");
  assert(tasks[1].outputPath).equals("src/index.ts");
  await testRoot.remove();
});

test.case("should produce own tasks plus suboutput tasks for output with includes", async assert => {
  await reset();
  await writeOutput("child", {
    name: "child",
    variables: ["componentName", "theme"],
    intent: [],
    output: {
      create: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
      modify: [],
    },
  });
  await writeOutput("parent", {
    name: "parent",
    variables: ["theme"],
    intent: [],
    output: {
      create: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
      modify: [],
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
    outputsFolder: templateFolder,
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

test.case("should produce a flat list of all tasks for nested suboutputs", async assert => {
  await reset();
  await writeOutput("nest-c", {
    name: "nest-c",
    variables: ["val"],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "c.ts" }], modify: [] },
  });
  await writeOutput("nest-b", {
    name: "nest-b",
    variables: ["val"],
    intent: [],
    output: { create: [{ name: "f", template: "b.njk", outputPath: "b.ts" }], modify: [] },
    includes: [{ name: "nest-c", variables: { val: "{{val}}" } }],
  });
  await writeOutput("nest-a", {
    name: "nest-a",
    variables: ["val"],
    intent: [],
    output: { create: [{ name: "f", template: "a.njk", outputPath: "a.ts" }], modify: [] },
    includes: [{ name: "nest-b", variables: { val: "{{val}}" } }],
  });

  const tasks = await resolveOutput({
    outputName: "nest-a",
    variables: { val: "test" },
    outputsFolder: templateFolder,
  });

  assert(tasks.length).equals(3);
  assert(tasks[0].outputPath).equals("a.ts");
  assert(tasks[1].outputPath).equals("b.ts");
  assert(tasks[2].outputPath).equals("c.ts");
  // Variable flows through all levels
  assert(tasks[2].variables.val).equals("test");
  await testRoot.remove();
});

test.case("should pass a static value through for variable mapping", async assert => {
  await reset();
  await writeOutput("static-child", {
    name: "static-child",
    variables: ["componentName"],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "out.ts" }], modify: [] },
  });
  await writeOutput("static-parent", {
    name: "static-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "static-child", variables: { componentName: "Button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "static-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  assert(tasks[0].variables.componentName).equals("Button");
  await testRoot.remove();
});

test.case("should resolve a parentVar reference for variable mapping", async assert => {
  await reset();
  await writeOutput("ref-child", {
    name: "ref-child",
    variables: ["theme"],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "out.ts" }], modify: [] },
  });
  await writeOutput("ref-parent", {
    name: "ref-parent",
    variables: ["theme"],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "ref-child", variables: { theme: "{{theme}}" } }],
  });

  const tasks = await resolveOutput({
    outputName: "ref-parent",
    variables: { theme: "dark" },
    outputsFolder: templateFolder,
  });

  assert(tasks[0].variables.theme).equals("dark");
  await testRoot.remove();
});

test.case("should resolve mixed text and tokens for variable mapping", async assert => {
  await reset();
  await writeOutput("mixed-child", {
    name: "mixed-child",
    variables: ["variant"],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "out.ts" }], modify: [] },
  });
  await writeOutput("mixed-parent", {
    name: "mixed-parent",
    variables: ["theme"],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "mixed-child", variables: { variant: "{{theme}}-button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "mixed-parent",
    variables: { theme: "dark" },
    outputsFolder: templateFolder,
  });

  assert(tasks[0].variables.variant).equals("dark-button");
  await testRoot.remove();
});

test.case("should apply create output path override to the correct file by name", async assert => {
  await reset();
  await writeOutput("override-child", {
    name: "override-child",
    variables: ["componentName"],
    intent: [],
    output: {
      create: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
      modify: [],
    },
  });
  await writeOutput("override-parent", {
    name: "override-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "override-child",
        variables: { componentName: "Button" },
        outputPathOverride: { create: { comp: "src/ui/{{componentName}}.tsx" } },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "override-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  assert(tasks[0].outputPath).equals("src/ui/{{componentName}}.tsx");
  await testRoot.remove();
});

test.case("should apply modify output path override to the correct file by name", async assert => {
  await reset();
  await writeOutput("modify-override-child", {
    name: "modify-override-child",
    variables: ["name"],
    intent: [],
    output: {
      create: [],
      modify: [{ name: "wire", template: "w.json", outputPath: "src/index.ts" }],
    },
  });
  await writeOutput("modify-override-parent", {
    name: "modify-override-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "modify-override-child",
        variables: { name: "User" },
        outputPathOverride: { modify: { wire: "src/custom/index.ts" } },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "modify-override-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  assert(tasks.length).equals(1);
  assert(tasks[0].kind).equals("modify");
  assert(tasks[0].outputPath).equals("src/custom/index.ts");
  await testRoot.remove();
});

test.case("should preserve the original outputPath when no override is given", async assert => {
  await reset();
  await writeOutput("no-override-child", {
    name: "no-override-child",
    variables: ["componentName"],
    intent: [],
    output: {
      create: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
      modify: [],
    },
  });
  await writeOutput("no-override-parent", {
    name: "no-override-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "no-override-child", variables: { componentName: "Button" } }],
  });

  const tasks = await resolveOutput({
    outputName: "no-override-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  assert(tasks[0].outputPath).equals("src/{{componentName}}.tsx");
  await testRoot.remove();
});

test.case("should produce distinct tasks when the same suboutput is referenced twice with different variables", async assert => {
  await reset();
  await writeOutput("dual-child", {
    name: "dual-child",
    variables: ["componentName"],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }], modify: [] },
  });
  await writeOutput("dual-parent", {
    name: "dual-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      { name: "dual-child", variables: { componentName: "Primary" } },
      { name: "dual-child", variables: { componentName: "Secondary" } },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "dual-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  assert(tasks.length).equals(2);
  assert(tasks[0].variables.componentName).equals("Primary");
  assert(tasks[1].variables.componentName).equals("Secondary");
  await testRoot.remove();
});

test.case("should not cascade overrides to nested suboutputs", async assert => {
  await reset();
  await writeOutput("cascade-grandchild", {
    name: "cascade-grandchild",
    variables: [],
    intent: [],
    output: { create: [{ name: "f", template: "g.njk", outputPath: "original.ts" }], modify: [] },
  });
  await writeOutput("cascade-child", {
    name: "cascade-child",
    variables: [],
    intent: [],
    output: { create: [{ name: "f", template: "c.njk", outputPath: "original.ts" }], modify: [] },
    includes: [{ name: "cascade-grandchild", variables: {} }],
  });
  await writeOutput("cascade-parent", {
    name: "cascade-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "cascade-child",
        variables: {},
        outputPathOverride: { create: { f: "overridden.ts" } },
      },
    ],
  });

  const tasks = await resolveOutput({
    outputName: "cascade-parent",
    variables: {},
    outputsFolder: templateFolder,
  });

  // Child's file is overridden
  assert(tasks[0].outputPath).equals("overridden.ts");
  // Grandchild's file is NOT overridden (override doesn't cascade)
  assert(tasks[1].outputPath).equals("original.ts");
  await testRoot.remove();
});