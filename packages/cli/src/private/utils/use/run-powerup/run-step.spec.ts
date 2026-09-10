import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { UseErrorCode } from "#errors/useErrors";
import runStep from "#utils/use/run-powerup/run-step";
import type { DynamicCreateStep, ReadStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-step-test-powerup");
const testDestinationDir = testRoot.append("/run-step-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testPowerupDir.append("/dist"));
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

async function createTemplateFile(): Promise<void> {
  await fs.write(
    testPowerupDir.append("/dist/component.ts"),
    `export default (vars: Record<string, string>) => \`export const \${vars.name} = "hello";\`;`,
  );
}

test.case("routes to create step and returns correct manifest", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const createStep: DynamicCreateStep = {
    type: "dynamic-create",
    name: "create-component",
    template: "component.ts",
    outputPath: "src/{{name}}.ts",
  };

  const { manifest } = await runStep({
    step: createStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    sourceBase: testPowerupDir.append("/dist"),
    overwriteExisting: false,
    skipInstallSteps: false,
    variables: { name: "MyComponent" },
    powerupName: "test-powerup",
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
    powerupType: "multi-use",
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("dynamic-create");

  if (manifest.output.type === "create") {
    assert(manifest.output.path).equals("src/MyComponent.ts");
  }

  assert(await testDestinationDir.append("/src/MyComponent.ts").exists()).true();

  await cleanup();
});

test.case("resolves variableMap before dispatching to step runner", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const createStepWithVariableMap: DynamicCreateStep = {
    type: "dynamic-create",
    name: "create-mapped",
    template: "component.ts",
    outputPath: "src/{{name}}.ts",
    variableMap: { name: "{{componentName}}" },
  };

  const { manifest } = await runStep({
    step: createStepWithVariableMap,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    sourceBase: testPowerupDir.append("/dist"),
    overwriteExisting: false,
    skipInstallSteps: false,
    variables: { componentName: "Widget" },
    powerupName: "test-powerup",
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
    powerupType: "multi-use",
  });

  assert(manifest.status).equals("applied");
  assert(await testDestinationDir.append("/src/Widget.ts").exists()).true();

  const content = (await testDestinationDir.append("/src/Widget.ts").text()).trim();
  assert(content).equals(`export const Widget = "hello";`);

  await cleanup();
});

test.case("passes through variableUpdate from read step", async assert => {
  await setupTestDir();

  await fs.write(testDestinationDir.append("/config.json"), JSON.stringify({ port: 3000 }));

  const readStep: ReadStep = {
    type: "read",
    name: "read-port",
    path: "config.json",
    as: "serverPort",
    jsonPath: "port",
  };

  const { manifest, variableUpdate } = await runStep({
    step: readStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    sourceBase: testPowerupDir.append("/dist"),
    overwriteExisting: false,
    skipInstallSteps: false,
    variables: {},
    powerupName: "test-powerup",
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
    powerupType: "multi-use",
  });

  assert(manifest.stepType).equals("read");
  assert(manifest.status).equals("applied");
  assert(variableUpdate!.name).equals("serverPort");
  assert(variableUpdate!.value).equals("3000");

  await cleanup();
});

test.case("throws unsupported_step_type error for unknown step type", async assert => {
  await setupTestDir();

  await assert(runStep({
    step: { type: "unknown", name: "bad-step" } as never,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    sourceBase: testPowerupDir.append("/dist"),
    overwriteExisting: false,
    skipInstallSteps: false,
    variables: {},
    powerupName: "test-powerup",
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
    powerupType: "multi-use",
  })).throwsAsync(UseErrorCode.unsupported_step_type);

  await cleanup();
});