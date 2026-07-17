import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { checkOutput } from "#utils/check-output";
import { MAIN_FOLDER, ACTIVE_FOLDER, MULTI_USE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const multiUseFolder: FileRef = mainFolder.append(`/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);

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
    output: { create: [], modify: [] },
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
    output: {
      create: [{ name: "f", template: "nonexistent.njk", outputPath: "out.ts" }],
      modify: [],
    },
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
    output: {
      create: [],
      modify: [{ name: "wire", template: "nonexistent.json", outputPath: "src/index.ts" }],
    },
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
    output: {
      create: [{ name: "controller", template: "controller.ts", outputPath: "src/c.ts" }],
      modify: [{ name: "wire", template: "wire.json", outputPath: "src/index.ts" }],
    },
  } as never);
  await dir.append("/template/controller.ts").write("test");
  await dir.append("/template/wire.json").write("[]");

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
    output: { create: [], modify: [] },
  });
  await writeOutput("valid-parent", {
    name: "valid-parent",
    description: "test description",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "valid-child", variables: { componentName: "Button" } }],
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
    output: { create: [], modify: [] },
  });
  await writeOutput("bad-parent", {
    name: "bad-parent",
    description: "test description",
    variables: { required: [] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "nonexistent", variables: {} }],
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
    output: { create: [], modify: [] },
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
    output: {
      create: [{ name: "f", template: "f.njk", outputPath: "src/{{name}}.ts" }],
      modify: [],
    },
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
    output: {
      create: [{ name: "f", template: "f.njk", outputPath: "src/{{name}}.ts" }],
      modify: [],
    },
  });

  const issues = await checkOutput({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/opt-clean"),
  });

  assert(issues.some(i => i.includes("optional"))).false();
  await testRoot.remove();
});
