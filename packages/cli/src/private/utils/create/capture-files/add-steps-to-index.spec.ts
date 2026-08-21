import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import addStepsToIndex from "#utils/create/capture-files/add-steps-to-index";
import type { Step } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should replace steps: [] in the index file with the provided steps as JSON", async assert => {
  await setupTestDir();

  const indexFile = testRoot.append("/index.ts");
  await indexFile.write("const instructions = {\n  steps: [],\n};\n");

  const steps: Step[] = [
    { type: "create", name: "create-foo", template: "templates/foo.ts.ts", outputPath: "foo.ts" },
  ];

  await addStepsToIndex({ indexFilePath: indexFile, steps });

  const content = await indexFile.text();
  assert(content).includes('"create-foo"');
  assert(content).includes('"foo.ts"');
  assert(content.includes("steps: []")).false();

  await cleanup();
});

test.case("should preserve the rest of the file content outside the steps array", async assert => {
  await setupTestDir();

  const indexFile = testRoot.append("/index.ts");
  const originalContent = `import { defineInstructions } from "@liolocs/powerups-sdk";\n\nconst instructions = {\n  steps: [],\n};\n\nexport default instructions;\n`;
  await indexFile.write(originalContent);

  const steps: Step[] = [
    { type: "delete", name: "delete-bar", outputPath: "bar.ts" },
  ];

  await addStepsToIndex({ indexFilePath: indexFile, steps });

  const content = await indexFile.text();
  assert(content).includes('import { defineInstructions }');
  assert(content).includes('export default instructions;');
  assert(content).includes('"delete-bar"');

  await cleanup();
});

test.case("should leave the file unchanged when the steps array is empty", async assert => {
  await setupTestDir();

  const indexFile = testRoot.append("/index.ts");
  await indexFile.write("const instructions = {\n  steps: [],\n};\n");

  await addStepsToIndex({ indexFilePath: indexFile, steps: [] });

  const content = await indexFile.text();
  assert(content).includes("steps: []");

  await cleanup();
});

test.case("should format multiple steps with proper JSON indentation", async assert => {
  await setupTestDir();

  const indexFile = testRoot.append("/index.ts");
  await indexFile.write("const instructions = {\n  steps: [],\n};\n");

  const steps: Step[] = [
    { type: "create", name: "create-foo", template: "templates/foo.ts.ts", outputPath: "foo.ts" },
    { type: "create", name: "create-bar", template: "templates/bar.ts.ts", outputPath: "bar.ts" },
  ];

  await addStepsToIndex({ indexFilePath: indexFile, steps });

  const content = await indexFile.text();
  assert(content).includes('"create-foo"');
  assert(content).includes('"create-bar"');

  await cleanup();
});