import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runDynamicCreateStep from "#utils/use/run-powerup/steps/run-dynamic-create-step/index";
import type { DynamicCreateStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-create-step-test-powerup");
const testSourceBase = testPowerupDir.append("/dist");
const testDestinationDir = testRoot.append("/run-create-step-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testSourceBase);
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

function createTemplateFile(): Promise<void> {
  return fs.write(
    testSourceBase.append("/component.ts"),
    `export default (vars: Record<string, string>) => \`export const \${vars.name} = "hello";\`;`,
  );
}

const baseStep: DynamicCreateStep = {
  type: "dynamic-create",
  name: "create-component",
  template: "component.ts",
  outputPath: "src/{{name}}.ts",
};

test.case("writes a file to the correct resolved path and returns applied manifest with CreateOutput", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const { manifest } = await runDynamicCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "MyComponent" },
    overwriteExisting: false,
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("dynamic-create");

  if (manifest.output.type === "create") {
    assert(manifest.output.path).equals("src/MyComponent.ts");
    assert(manifest.output.action).equals("create");
    assert(manifest.output.characterCount).defined();
  }

  const writtenContent = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(writtenContent).equals(`export const MyComponent = "hello";`);

  await cleanup();
});

test.case("skips with skipped-warning when destination file already exists and overwrite is false", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const targetDir = testDestinationDir.append("/src");
  await fs.create(targetDir);
  await fs.write(testDestinationDir.append("/src/MyComponent.ts"), "existing content");

  const { manifest } = await runDynamicCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "MyComponent" },
    overwriteExisting: false,
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("existing content");

  await cleanup();
});

test.case("overwrites existing file when overwriteExisting is true", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const targetDir = testDestinationDir.append("/src");
  await fs.create(targetDir);
  await fs.write(testDestinationDir.append("/src/MyComponent.ts"), "existing content");

  const { manifest } = await runDynamicCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "MyComponent" },
    overwriteExisting: true,
  });

  assert(manifest.status).equals("applied");

  const writtenContent = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(writtenContent).equals(`export const MyComponent = "hello";`);

  await cleanup();
});

test.case("dry-run with file not existing returns applied manifest, does NOT write the file", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const { manifest } = await runDynamicCreateStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "MyComponent" },
    overwriteExisting: false,
  });

  assert(manifest.status).equals("applied");
  assert(await testDestinationDir.append("/src/MyComponent.ts").exists()).false();

  await cleanup();
});

test.case("different variable values produce different output paths and content", async assert => {
  await setupTestDir();
  await createTemplateFile();

  await runDynamicCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "First" },
    overwriteExisting: false,
  });

  await runDynamicCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "Second" },
    overwriteExisting: false,
  });

  const firstContent = (await testDestinationDir.append("/src/First.ts").text()).trim();
  const secondContent = (await testDestinationDir.append("/src/Second.ts").text()).trim();

  assert(firstContent).equals(`export const First = "hello";`);
  assert(secondContent).equals(`export const Second = "hello";`);

  await cleanup();
});

test.case("creates parent directories that do not exist yet", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const deepStep: DynamicCreateStep = {
    type: "dynamic-create",
    name: "create-nested",
    template: "component.ts",
    outputPath: "src/deep/nested/{{name}}.ts",
  };

  await runDynamicCreateStep({
    step: deepStep,
    isDryRun: false,
    destination: testDestinationDir,
    sourceBase: testSourceBase,
    variables: { name: "Nested" },
    overwriteExisting: false,
  });

  assert(await testDestinationDir.append("/src/deep/nested/Nested.ts").exists()).true();

  await cleanup();
});