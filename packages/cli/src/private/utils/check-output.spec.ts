import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { checkOutput } from "#utils/check-output";
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

test.case("should return no issues for valid output with no includes", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    variables: ["ComponentName"],
    intent: [],
    output: { create: [], modify: [] },
  });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return an issue for missing instructions.json", async assert => {
  await reset();
  const dir = templateFolder.append("/empty");
  await fs.create(dir);

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("instructions.json not found");
  await testRoot.remove();
});

test.case("should return an issue for schema parse failure and skip suboutput checks", async assert => {
  await reset();
  const dir = templateFolder.append("/bad-schema");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({ name: 123 });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  await testRoot.remove();
});

test.case("should return an issue for a missing create template file", async assert => {
  await reset();
  await writeOutput("missing-tmpl", {
    name: "missing-tmpl",
    variables: [],
    intent: [],
    output: {
      create: [{ name: "f", template: "nonexistent.njk", outputPath: "out.ts" }],
      modify: [],
    },
  });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/missing-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.njk"))).true();
  await testRoot.remove();
});

test.case("should return an issue for a missing modify template file", async assert => {
  await reset();
  await writeOutput("missing-modify-tmpl", {
    name: "missing-modify-tmpl",
    variables: [],
    intent: [],
    output: {
      create: [],
      modify: [{ name: "wire", template: "nonexistent.json", outputPath: "src/index.ts" }],
    },
  });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/missing-modify-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.json"))).true();
  await testRoot.remove();
});

test.case("should return no issues for valid output with both create and modify entries", async assert => {
  await reset();
  const dir = templateFolder.append("/both");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({
    name: "both",
    variables: [],
    intent: [],
    output: {
      create: [{ name: "controller", template: "controller.ts", outputPath: "src/c.ts" }],
      modify: [{ name: "wire", template: "wire.json", outputPath: "src/index.ts" }],
    },
  } as never);
  await dir.append("/controller.ts").write("test");
  await dir.append("/wire.json").write("[]");

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return no issues for valid output with valid suboutputs", async assert => {
  await reset();
  await writeOutput("valid-child", {
    name: "valid-child",
    variables: ["componentName"],
    intent: [],
    output: { create: [], modify: [] },
  });
  await writeOutput("valid-parent", {
    name: "valid-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "valid-child", variables: { componentName: "Button" } }],
  });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should merge suboutput issues for valid output with invalid suboutput tree", async assert => {
  await reset();
  await writeOutput("missing-child-ref", {
    name: "missing-child-ref",
    variables: ["componentName"],
    intent: [],
    output: { create: [], modify: [] },
  });
  await writeOutput("bad-parent", {
    name: "bad-parent",
    variables: [],
    intent: [],
    output: { create: [], modify: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const issues = await checkOutput({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/bad-parent"),
  });

  assert(issues.some(i => i.includes("suboutput not found: nonexistent"))).true();
  await testRoot.remove();
});