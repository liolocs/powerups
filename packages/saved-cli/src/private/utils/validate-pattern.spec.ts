import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validatePatternTree } from "#utils/validate-pattern";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const patternsFolder: FileRef = mainFolder.append(`/${PATTERNS_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(patternsFolder);
}

async function writePattern(name: string, instructions: Record<string, unknown>) {
  const dir = patternsFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("valid tree with no includes returns no issues", async assert => {
  await reset();
  await writePattern("simple", {
    name: "simple",
    variables: ["ComponentName"],
    intent: [],
    output: { files: [] },
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid tree with one subpattern returns no issues", async assert => {
  await reset();
  await writePattern("button", {
    name: "button",
    variables: ["componentName", "theme"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("all-components", {
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

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/all-components"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid nested subpatterns (A->B->C) returns no issues", async assert => {
  await reset();
  await writePattern("c", {
    name: "c",
    variables: ["val"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("b", {
    name: "b",
    variables: ["val"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "c", variables: { val: "{{val}}" } }],
  });
  await writePattern("a", {
    name: "a",
    variables: ["val"],
    intent: [],
    output: { files: [] },
    includes: [{ name: "b", variables: { val: "{{val}}" } }],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("missing subpattern reports issue", async assert => {
  await reset();
  await writePattern("parent", {
    name: "parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("subpattern not found: nonexistent");
  await testRoot.remove();
});

test.case("circular reference (A->B->A) reports issue with chain", async assert => {
  await reset();
  await writePattern("a-cycle", {
    name: "a-cycle",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "b-cycle", variables: {} }],
  });
  await writePattern("b-cycle", {
    name: "b-cycle",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "a-cycle", variables: {} }],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/a-cycle"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("a-cycle → b-cycle → a-cycle"))).true();
  await testRoot.remove();
});

test.case("deep circular reference (A->B->C->B) reports issue with chain", async assert => {
  await reset();
  await writePattern("deep-a", {
    name: "deep-a",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-b", variables: {} }],
  });
  await writePattern("deep-b", {
    name: "deep-b",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-c", variables: {} }],
  });
  await writePattern("deep-c", {
    name: "deep-c",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "deep-b", variables: {} }],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/deep-a"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("deep-b → deep-c → deep-b"))).true();
  await testRoot.remove();
});

test.case("diamond shape (A->B, A->C, C->B) is not a cycle", async assert => {
  await reset();
  await writePattern("diamond-b", {
    name: "diamond-b",
    variables: [],
    intent: [],
    output: { files: [] },
  });
  await writePattern("diamond-c", {
    name: "diamond-c",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "diamond-b", variables: {} }],
  });
  await writePattern("diamond-a", {
    name: "diamond-a",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "diamond-b", variables: {} },
      { name: "diamond-c", variables: {} },
    ],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/diamond-a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("unmapped variable reports issue", async assert => {
  await reset();
  await writePattern("child-needs-vars", {
    name: "child-needs-vars",
    variables: ["componentName", "theme"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("parent-missing-map", {
    name: "parent-missing-map",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "child-needs-vars", variables: { componentName: "Button" } },
    ],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/parent-missing-map"),
  });

  assert(issues.some(i => i.includes("unmapped variable: theme"))).true();
  assert(issues.some(i => i.includes("child-needs-vars"))).true();
  await testRoot.remove();
});

test.case("invalid parentVar reference reports issue", async assert => {
  await reset();
  await writePattern("ref-child", {
    name: "ref-child",
    variables: ["val"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("ref-parent", {
    name: "ref-parent",
    variables: ["theme"],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "ref-child", variables: { val: "{{nonexistent}}" } },
    ],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/ref-parent"),
  });

  assert(issues.some(i => i.includes("invalid reference"))).true();
  assert(issues.some(i => i.includes("nonexistent"))).true();
  await testRoot.remove();
});

test.case("override file name not in subpattern reports issue", async assert => {
  await reset();
  await writePattern("override-child", {
    name: "override-child",
    variables: [],
    intent: [],
    output: {
      files: [{ name: "real-file", template: "t.njk", outputPath: "out.ts" }],
    },
  });
  await writePattern("override-parent", {
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

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-file"))).true();
  await testRoot.remove();
});

test.case("same subpattern referenced twice validates both independently", async assert => {
  await reset();
  await writePattern("dual-child", {
    name: "dual-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("dual-parent", {
    name: "dual-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [
      { name: "dual-child", variables: { componentName: "Primary" } },
      { name: "dual-child", variables: { componentName: "Secondary" } },
    ],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/dual-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("subpattern with unparseable instructions reports issue and skips recursion", async assert => {
  await reset();
  const childDir = patternsFolder.append("/broken-child");
  await fs.create(childDir);
  await childDir.append("/instructions.json").writeJSON({ name: 123 });
  await writePattern("broken-parent", {
    name: "broken-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "broken-child", variables: {} }],
  });

  const issues = await validatePatternTree({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/broken-parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("broken-child");
  await testRoot.remove();
});