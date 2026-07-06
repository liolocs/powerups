import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validateOutputTree } from "#utils/validate-output";
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

test.case("valid tree with no includes returns no issues", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    variables: ["ComponentName"],
    intent: [],
    output: { files: [] },
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid tree with one suboutput returns no issues", async assert => {
  await reset();
  await writeOutput("button", {
    name: "button",
    variables: ["componentName", "theme"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("all-components", {
    name: "all-components",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [
      {
        name: "button",
        variables: { componentName: "Button", theme: "{{theme}}" },
      },
    ],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/all-components"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid nested suboutputs (A->B->C) returns no issues", async assert => {
  await reset();
  await writeOutput("c", {
    name: "c",
    variables: ["val"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("b", {
    name: "b",
    variables: ["val"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "c", variables: { val: "{{val}}" } }],
  });
  await writeOutput("a", {
    name: "a",
    variables: ["val"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "b", variables: { val: "{{val}}" } }],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("missing suboutput reports issue", async assert => {
  await reset();
  await writeOutput("parent", {
    name: "parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("suboutput not found: nonexistent");
  await testRoot.remove();
});

test.case("circular reference (A->B->A) reports issue with chain", async assert => {
  await reset();
  await writeOutput("a-cycle", {
    name: "a-cycle",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "b-cycle", variables: {} }],
  });
  await writeOutput("b-cycle", {
    name: "b-cycle",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "a-cycle", variables: {} }],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/a-cycle"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("a-cycle → b-cycle → a-cycle"))).true();
  await testRoot.remove();
});

test.case("deep circular reference (A->B->C->B) reports issue with chain", async assert => {
  await reset();
  await writeOutput("deep-a", {
    name: "deep-a",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-b", variables: {} }],
  });
  await writeOutput("deep-b", {
    name: "deep-b",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-c", variables: {} }],
  });
  await writeOutput("deep-c", {
    name: "deep-c",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-b", variables: {} }],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/deep-a"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("deep-b → deep-c → deep-b"))).true();
  await testRoot.remove();
});

test.case("diamond shape (A->B, A->C, C->B) is not a cycle", async assert => {
  await reset();
  await writeOutput("diamond-b", {
    name: "diamond-b",
    variables: [],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("diamond-c", {
    name: "diamond-c",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "diamond-b", variables: {} }],
  });
  await writeOutput("diamond-a", {
    name: "diamond-a",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "diamond-b", variables: {} },
      { name: "diamond-c", variables: {} },
    ],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/diamond-a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("unmapped variable reports issue", async assert => {
  await reset();
  await writeOutput("child-needs-vars", {
    name: "child-needs-vars",
    variables: ["componentName", "theme"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("parent-missing-map", {
    name: "parent-missing-map",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "child-needs-vars", variables: { componentName: "Button" } },
    ],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/parent-missing-map"),
  });

  assert(issues.some(i => i.includes("unmapped variable: theme"))).true();
  assert(issues.some(i => i.includes("child-needs-vars"))).true();
  await testRoot.remove();
});

test.case("invalid parentVar reference reports issue", async assert => {
  await reset();
  await writeOutput("ref-child", {
    name: "ref-child",
    variables: ["val"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("ref-parent", {
    name: "ref-parent",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "ref-child", variables: { val: "{{nonexistent}}" } },
    ],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/ref-parent"),
  });

  assert(issues.some(i => i.includes("invalid reference"))).true();
  assert(issues.some(i => i.includes("nonexistent"))).true();
  await testRoot.remove();
});

test.case("override file name not in suboutput reports issue", async assert => {
  await reset();
  await writeOutput("override-child", {
    name: "override-child",
    variables: [],
    intent: [],
    output: {
      files: [{ name: "real-file", template: "t.njk", outputPath: "out.ts" }],
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
        variables: {},
        files: { "nonexistent-file": "src/new.ts" },
      },
    ],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-file"))).true();
  await testRoot.remove();
});

test.case("same suboutput referenced twice validates both independently", async assert => {
  await reset();
  await writeOutput("dual-child", {
    name: "dual-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
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

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/dual-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("suboutput with unparseable instructions reports issue and skips recursion", async assert => {
  await reset();
  const childDir = outputsFolder.append("/broken-child");
  await fs.create(childDir);
  await childDir.append("/instructions.json").writeJSON({ name: 123 });
  await writeOutput("broken-parent", {
    name: "broken-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "broken-child", variables: {} }],
  });

  const issues = await validateOutputTree({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/broken-parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("broken-child");
  await testRoot.remove();
});