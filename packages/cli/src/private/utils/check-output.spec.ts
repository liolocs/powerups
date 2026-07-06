import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { checkOutput } from "#utils/check-output";
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

test.case("valid output with no includes returns no issues", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    variables: ["ComponentName"],
    intent: [],
    output: { files: [] },
  });

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("missing instructions.json returns issue", async assert => {
  await reset();
  const dir = outputsFolder.append("/empty");
  await fs.create(dir);

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("instructions.json not found");
  await testRoot.remove();
});

test.case("schema parse failure returns issue and skips suboutput checks", async assert => {
  await reset();
  const dir = outputsFolder.append("/bad-schema");
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON({ name: 123 });

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: dir,
  });

  assert(issues.length).equals(1);
  await testRoot.remove();
});

test.case("missing template file returns issue", async assert => {
  await reset();
  await writeOutput("missing-tmpl", {
    name: "missing-tmpl",
    variables: [],
    intent: [],
    output: {
      files: [{ name: "f", template: "nonexistent.njk", outputPath: "out.ts" }],
    },
  });

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/missing-tmpl"),
  });

  assert(issues.some(i => i.includes("missing template file: nonexistent.njk"))).true();
  await testRoot.remove();
});

test.case("valid output with valid suboutputs returns no issues", async assert => {
  await reset();
  await writeOutput("valid-child", {
    name: "valid-child",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("valid-parent", {
    name: "valid-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "valid-child", variables: { componentName: "Button" } }],
  });

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("valid output with invalid suboutput tree merges suboutput issues", async assert => {
  await reset();
  await writeOutput("missing-child-ref", {
    name: "missing-child-ref",
    variables: ["componentName"],
    intent: [],
    output: { files: [] },
  });
  await writeOutput("bad-parent", {
    name: "bad-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const issues = await checkOutput({
    rootOutputDir: outputsFolder,
    currentOutputDir: outputsFolder.append("/bad-parent"),
  });

  assert(issues.some(i => i.includes("suboutput not found: nonexistent"))).true();
  await testRoot.remove();
});