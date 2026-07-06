import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { checkPattern } from "#utils/check-pattern";
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
  await dir.append("/instructions.json").writeJSON(instructions);
}

test.case("valid pattern with no includes returns no issues", async assert => {
  await reset();
  await writePattern("simple", {
    name: "simple",
    variables: ["ComponentName"],
    intent: [],
    output: { files: [] },
  });

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("missing instructions.json returns issue", async assert => {
  await reset();
  const dir = patternsFolder.append("/empty");
  await fs.create(dir);

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: dir,
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("instructions.json not found");
  await testRoot.remove();
});

test.case("schema parse failure returns issue and skips subpattern checks", async assert => {
  await reset();
  const dir = patternsFolder.append("/bad-schema");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({ name: 123 });

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: dir,
  });

  assert(issues.length).equals(1);
  await testRoot.remove();
});

test.case("missing template file returns issue", async assert => {
  await reset();
  await writePattern("missing-tmpl", {
    name: "missing-tmpl",
    variables: [],
    intent: [],
    output: {
      files: [{ name: "f", template: "nonexistent.njk", outputPath: "out.ts" }],
    },
  });

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/missing-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.njk"))).true();
  await testRoot.remove();
});

test.case("valid pattern with valid subpatterns returns no issues", async assert => {
  await reset();
  await writePattern("valid-child", {
    name: "valid-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("valid-parent", {
    name: "valid-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "valid-child", variables: { componentName: "Button" } }],
  });

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid pattern with invalid subpattern tree merges subpattern issues", async assert => {
  await reset();
  await writePattern("missing-child-ref", {
    name: "missing-child-ref",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
  });
  await writePattern("bad-parent", {
    name: "bad-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const issues = await checkPattern({
    rootPatternDir: patternsFolder,
    currentPatternDir: patternsFolder.append("/bad-parent"),
  });

  assert(issues.some(i => i.includes("subpattern not found: nonexistent"))).true();
  await testRoot.remove();
});