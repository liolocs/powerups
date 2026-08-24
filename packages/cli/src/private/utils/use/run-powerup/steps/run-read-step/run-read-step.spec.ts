import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { UseErrorCode } from "#errors/useErrors";
import type { ResolvedVariable } from "#utils/variables";
import runReadStep from "#utils/use/run-powerup/steps/run-read-step/index";
import type { ReadStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-read-step-test-powerup");
const testDestinationDir = testRoot.append("/run-read-step-test-destination");

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

test.case("reads a file in raw mode and returns applied manifest with ReadOutput", async assert => {
  await setupTestDir();
  await fs.write(testDestinationDir.append("/package.json"), "some raw content");

  const step: ReadStep = {
    type: "read",
    name: "read-pkg",
    path: "package.json",
    as: "packageContents",
  };

  const { manifest, variableUpdate } = await runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("read");

  if (manifest.output.type === "read") {
    assert(manifest.output.variable).equals("packageContents");
  }

  assert(variableUpdate.name).equals("packageContents");
  assert(variableUpdate.value).equals("some raw content\n");

  await cleanup();
});

test.case("reads a JSON file with jsonPath and returns the resolved value", async assert => {
  await setupTestDir();
  await fs.write(
    testDestinationDir.append("/config.json"),
    JSON.stringify({ server: { port: 3000 } }),
  );

  const step: ReadStep = {
    type: "read",
    name: "read-port",
    path: "config.json",
    as: "port",
    jsonPath: "server.port",
  };

  const { variableUpdate } = await runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  });

  assert(variableUpdate.value).equals("3000");

  await cleanup();
});

test.case("throws read_file_not_found when target file does not exist", async assert => {
  await setupTestDir();

  const step: ReadStep = {
    type: "read",
    name: "read-missing",
    path: "nonexistent.json",
    as: "missing",
  };

  await assert(runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  })).throwsAsync(UseErrorCode.read_file_not_found);

  await cleanup();
});

test.case("throws read_json_parse_error when file is not valid JSON and jsonPath is set", async assert => {
  await setupTestDir();
  await fs.write(testDestinationDir.append("/bad.json"), "not valid json");

  const step: ReadStep = {
    type: "read",
    name: "read-bad",
    path: "bad.json",
    as: "badValue",
    jsonPath: "server.port",
  };

  await assert(runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  })).throwsAsync(UseErrorCode.read_json_parse_error);

  await cleanup();
});

test.case("throws read_json_path_not_found when JSON path does not resolve", async assert => {
  await setupTestDir();
  await fs.write(
    testDestinationDir.append("/config.json"),
    JSON.stringify({ server: { port: 3000 } }),
  );

  const step: ReadStep = {
    type: "read",
    name: "read-missing-path",
    path: "config.json",
    as: "missingPath",
    jsonPath: "server.nonexistent",
  };

  await assert(runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  })).throwsAsync(UseErrorCode.read_json_path_not_found);

  await cleanup();
});

test.case("template mode reads file content and passes it as __content to the template", async assert => {
  await setupTestDir();
  await fs.write(testDestinationDir.append("/data.txt"), "hello world");
  await fs.write(
    testPowerupDir.append("/dist/transform.ts"),
    `export default (vars: Record<string, string>) => vars.__content.toUpperCase();`,
  );

  const step: ReadStep = {
    type: "read",
    name: "read-transform",
    path: "data.txt",
    as: "transformed",
    template: "transform.ts",
  };

  const { variableUpdate } = await runReadStep({
    step,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: {},
  });

  assert(variableUpdate.value).equals("HELLO WORLD\n");

  await cleanup();
});

test.case("variable update uses resolved path with variables from a previous read", async assert => {
  await setupTestDir();
  await fs.write(
    testDestinationDir.append("/config.json"),
    JSON.stringify({ componentName: "MyWidget" }),
  );
  await fs.write(testDestinationDir.append("/MyWidget.ts"), "export const MyWidget = 1;");

  const variables: ResolvedVariable = {};

  const firstStep: ReadStep = {
    type: "read",
    name: "read-name",
    path: "config.json",
    as: "componentName",
    jsonPath: "componentName",
  };

  const firstResult = await runReadStep({
    step: firstStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables,
  });

  variables[firstResult.variableUpdate.name] = firstResult.variableUpdate.value;

  const secondStep: ReadStep = {
    type: "read",
    name: "read-component",
    path: "{{componentName}}.ts",
    as: "componentSource",
  };

  const secondResult = await runReadStep({
    step: secondStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables,
  });

  assert(secondResult.variableUpdate.value).equals("export const MyWidget = 1;\n");

  await cleanup();
});