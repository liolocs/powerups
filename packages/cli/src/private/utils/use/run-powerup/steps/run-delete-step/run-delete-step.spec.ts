import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runDeleteStep from "#utils/use/run-powerup/steps/run-delete-step/index";
import type { DeleteStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-delete-step-test-powerup");
const testDestinationDir = testRoot.append("/run-delete-step-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

const baseStep: DeleteStep = {
  type: "delete",
  name: "delete-file",
  outputPath: "src/{{componentName}}.ts",
};

test.case("deletes an existing file and returns applied manifest with DeleteOutput", async assert => {
  await setupTestDir();

  const srcDir = testDestinationDir.append("/src");
  await fs.create(srcDir);
  await fs.write(testDestinationDir.append("/src/OldWidget.ts"), "old content");

  const { manifest } = await runDeleteStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { componentName: "OldWidget" },
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("delete");

  if (manifest.output.type === "delete") {
    assert(manifest.output.path).equals("src/OldWidget.ts");
  }

  assert(await testDestinationDir.append("/src/OldWidget.ts").exists()).false();

  await cleanup();
});

test.case("skips with skipped-warning and NoneOutput when file does not exist", async assert => {
  await setupTestDir();

  const { manifest } = await runDeleteStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { componentName: "Nonexistent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  await cleanup();
});

test.case("dry-run with file existing returns applied manifest and does NOT remove the file", async assert => {
  await setupTestDir();

  const srcDir = testDestinationDir.append("/src");
  await fs.create(srcDir);
  await fs.write(testDestinationDir.append("/src/OldWidget.ts"), "old content");

  const { manifest } = await runDeleteStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { componentName: "OldWidget" },
  });

  assert(manifest.status).equals("applied");

  if (manifest.output.type === "delete") {
    assert(manifest.output.path).equals("src/OldWidget.ts");
  }

  assert(await testDestinationDir.append("/src/OldWidget.ts").exists()).true();

  await cleanup();
});

test.case("dry-run with file not existing returns skipped-warning and NoneOutput", async assert => {
  await setupTestDir();

  const { manifest } = await runDeleteStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { componentName: "Nonexistent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  await cleanup();
});

test.case("resolves variables in outputPath correctly", async assert => {
  await setupTestDir();

  const srcDir = testDestinationDir.append("/src");
  await fs.create(srcDir);
  await fs.write(testDestinationDir.append("/src/MyComponent.ts"), "component content");

  const { manifest } = await runDeleteStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { componentName: "MyComponent" },
  });

  assert(manifest.status).equals("applied");
  assert(await testDestinationDir.append("/src/MyComponent.ts").exists()).false();

  await cleanup();
});