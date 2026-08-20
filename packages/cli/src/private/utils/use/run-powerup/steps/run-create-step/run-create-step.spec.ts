import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import type { CreateStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-create-step-test-powerup");
const testDestinationDir = testRoot.append("/run-create-step-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

function createTemplateFile(): Promise<void> {
  return fs.write(
    testPowerupDir.append("/component.ts"),
    `export default (vars: Record<string, string>) => \`export const \${vars.name} = "hello";\`;`,
  );
}

const baseStep: CreateStep = {
  type: "create",
  name: "create-component",
  template: "component.ts",
  outputPath: "src/{{name}}.ts",
};

test.case("writes a file to the correct resolved path and returns applied manifest with CreateOutput", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const { manifest } = await runCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("create");

  if (manifest.output.type === "create") {
    assert(manifest.output.path).equals("src/MyComponent.ts");
    assert(manifest.output.action).equals("create");
    assert(manifest.output.characterCount).defined();
  }

  const writtenContent = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(writtenContent).equals(`export const MyComponent = "hello";`);

  await cleanup();
});

test.case("skips with skipped-warning and NoneOutput when destination file already exists", async assert => {
  await setupTestDir();
  await createTemplateFile();

  // Pre-create the destination file with different content
  const targetDir = testDestinationDir.append("/src");
  await fs.create(targetDir);
  await fs.write(testDestinationDir.append("/src/MyComponent.ts"), "existing content");

  const { manifest } = await runCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  // Verify the file content was NOT changed
  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("existing content");

  await cleanup();
});

test.case("dry-run with file not existing returns applied manifest, prints summary, does NOT write the file", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const { manifest } = await runCreateStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("applied");

  if (manifest.output.type === "create") {
    assert(manifest.output.path).equals("src/MyComponent.ts");
    assert(manifest.output.action).equals("create");
  }

  // Verify the file was NOT created
  assert(await testDestinationDir.append("/src/MyComponent.ts").exists()).false();

  await cleanup();
});

test.case("dry-run with file already existing returns skipped-warning and NoneOutput, does NOT write", async assert => {
  await setupTestDir();
  await createTemplateFile();

  // Pre-create the destination file
  const targetDir = testDestinationDir.append("/src");
  await fs.create(targetDir);
  await fs.write(testDestinationDir.append("/src/MyComponent.ts"), "existing content");

  const { manifest } = await runCreateStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  // Verify the file content was NOT changed
  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("existing content");

  await cleanup();
});

test.case("different variable values produce different output paths and content", async assert => {
  await setupTestDir();
  await createTemplateFile();

  await runCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "First" },
  });

  await runCreateStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "Second" },
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

  const deepStep: CreateStep = {
    type: "create",
    name: "create-nested",
    template: "component.ts",
    outputPath: "src/deep/nested/{{name}}.ts",
  };

  await runCreateStep({
    step: deepStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "Nested" },
  });

  assert(await testDestinationDir.append("/src/deep/nested/Nested.ts").exists()).true();

  await cleanup();
});