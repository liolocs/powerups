import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { checkOutput } from "#utils/check-output";
import { MAIN_FOLDER, MULTI_USE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const multiUseFolder: FileRef = mainFolder.append(`/${MULTI_USE_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(multiUseFolder);
}

async function writeOutput(name: string, instructions: Record<string, unknown>) {
  const dir = multiUseFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("should return no issues for valid output with no includes", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    description: "test description",
    variables: { required: ["ComponentName"] },
    intent: [],
    steps: [],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return an issue for missing instructions.json", async assert => {
  await reset();
  const dir = multiUseFolder.append("/empty");
  await fs.create(dir);

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("instructions.json not found");
  await testRoot.remove();
});

test.case("should return an issue for schema parse failure and skip suboutput checks", async assert => {
  await reset();
  const dir = multiUseFolder.append("/bad-schema");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({ name: 123 });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  await testRoot.remove();
});

test.case("should return an issue for a missing create template file", async assert => {
  await reset();
  await writeOutput("missing-tmpl", {
    name: "missing-tmpl",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "create", name: "f", template: "nonexistent.njk", outputPath: "out.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/missing-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.njk"))).true();
  await testRoot.remove();
});

test.case("should return an issue for a missing modify template file", async assert => {
  await reset();
  await writeOutput("missing-modify-tmpl", {
    name: "missing-modify-tmpl",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "modify", name: "wire", template: "nonexistent.json", outputPath: "src/index.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/missing-modify-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.json"))).true();
  await testRoot.remove();
});

test.case("should return no issues for valid output with both create and modify entries", async assert => {
  await reset();
  const dir = multiUseFolder.append("/both");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({
    name: "both",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "create", name: "controller", template: "controller.ts", outputPath: "src/c.ts" },
      { type: "modify", name: "wire", template: "wire.json", outputPath: "src/index.ts" },
    ],
  } as never);
  await dir.append("/controller.ts").write("test");
  await dir.append("/wire.json").write("[]");

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return no issues for valid output with valid suboutputs", async assert => {
  await reset();
  await writeOutput("valid-child", {
    name: "valid-child",
    description: "test description",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [],
  });
  await writeOutput("valid-parent", {
    name: "valid-parent",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "include", name: "valid-child", variables: { componentName: "Button" } },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should merge suboutput issues for valid output with invalid suboutput tree", async assert => {
  await reset();
  await writeOutput("missing-child-ref", {
    name: "missing-child-ref",
    description: "test description",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [],
  });
  await writeOutput("bad-parent", {
    name: "bad-parent",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "include", name: "nonexistent", variables: {} },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/bad-parent"),
  });

  assert(issues.some(i => i.includes("suboutput not found: nonexistent"))).true();
  await testRoot.remove();
});

test.case("should report issue for required/optional variable name collision", async assert => {
  await reset();
  await writeOutput("collision", {
    name: "collision",
    description: "test description",
    variables: { required: ["name"], optional: ["name"] },
    intent: [],
    steps: [],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/collision"),
  });

  assert(issues.some(i => i.includes("declared as both required and optional"))).true();
  await testRoot.remove();
});

test.case("should report issue for optional variable used in output path", async assert => {
  await reset();
  await writeOutput("opt-in-path", {
    name: "opt-in-path",
    description: "test description",
    variables: { required: [], optional: ["name"] },
    intent: [],
    steps: [
      { type: "create", name: "f", template: "f.njk", outputPath: "src/{{name}}.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/opt-in-path"),
  });

  assert(issues.some(i => i.includes("used in an output path but declared optional"))).true();
  await testRoot.remove();
});

test.case("should not report issue when optional variable is not in any output path", async assert => {
  await reset();
  await writeOutput("opt-clean", {
    name: "opt-clean",
    description: "test description",
    variables: { required: ["name"], optional: ["sub"] },
    intent: [],
    steps: [
      { type: "create", name: "f", template: "f.njk", outputPath: "src/{{name}}.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/opt-clean"),
  });

  assert(issues.some(i => i.includes("optional"))).false();
  await testRoot.remove();
});

test.case("should report issue for duplicate step name", async assert => {
  await reset();
  await writeOutput("dup-names", {
    name: "dup-names",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "a.njk", outputPath: "src/a.ts" },
      { type: "create", name: "comp", template: "b.njk", outputPath: "src/b.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/dup-names"),
  });

  assert(issues.some(i => i.includes("duplicate step name: comp"))).true();
  await testRoot.remove();
});

test.case("should flag variable used before its read step", async assert => {
  await reset();
  await writeOutput("bad-order", {
    name: "bad-order",
    description: "test description",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "c.njk", outputPath: "packages/{{packageName}}/config.ts" },
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/bad-order"),
  });

  assert(issues.some(i => i.includes("uses {{packageName}} before it is available"))).true();
  await testRoot.remove();
});

test.case("should not flag variable used after its read step", async assert => {
  await reset();
  await writeOutput("good-order", {
    name: "good-order",
    description: "test description",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
      { type: "create", name: "comp", template: "c.njk", outputPath: "packages/{{packageName}}/src/{{componentName}}.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/good-order"),
  });

  // Should only have template missing issue, not variable ordering issue
  assert(issues.some(i => i.includes("before it is available"))).false();
  await testRoot.remove();
});

test.case("should flag read step as shadowing a declared variable", async assert => {
  await reset();
  await writeOutput("shadow", {
    name: "shadow",
    description: "test description",
    variables: { required: ["packageName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
      { type: "create", name: "comp", template: "c.njk", outputPath: "src/{{packageName}}.ts" },
    ],
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/shadow"),
  });

  assert(issues.some(i => i.includes("shadows a declared variable"))).true();
  await testRoot.remove();
});