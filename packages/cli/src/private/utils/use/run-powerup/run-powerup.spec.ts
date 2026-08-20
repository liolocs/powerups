import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runPowerup from "#utils/use/run-powerup/index";
import type { Instructions, ManifestEntry } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-powerup-test-powerup");
const testDestinationDir = testRoot.append("/run-powerup-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("read then create flow with variable threading writes file and manifest", async assert => {
  await setupTestDir();

  await fs.write(testDestinationDir.append("/config.json"), JSON.stringify({ port: 3000 }));

  await fs.write(
    testPowerupDir.append("/server-template.ts"),
    `export default (vars: Record<string, string>) => \`const port = \${vars.serverPort};\`;`,
  );

  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "test powerup for read-create flow",
    variables: { required: [] },
    intent: ["test"],
    steps: [
      {
        type: "read",
        name: "read-config",
        path: "config.json",
        as: "serverPort",
        jsonPath: "port",
      },
      {
        type: "create",
        name: "create-server",
        template: "server-template.ts",
        outputPath: "server.ts",
      },
    ],
  };

  await runPowerup({
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    instructions,
    isDryRun: false,
    variables: {},
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
  });

  assert(await testDestinationDir.append("/server.ts").exists()).true();
  const content = (await testDestinationDir.append("/server.ts").text()).trim();
  assert(content).equals("const port = 3000;");

  const manifestPath = testPowerupDir.append("/manifest.jsonl");
  assert(await fs.exists(manifestPath)).true();

  const entries = await manifestPath.json() as unknown as ManifestEntry[];
  assert(entries.length).equals(2);
  assert(entries[0].stepType).equals("read");
  assert(entries[0].status).equals("applied");
  assert(entries[1].stepType).equals("create");
  assert(entries[1].status).equals("applied");

  await cleanup();
});

test.case("dry-run does not create manifest or write files to destination", async assert => {
  await setupTestDir();

  await fs.write(testDestinationDir.append("/config.json"), JSON.stringify({ port: 3000 }));

  await fs.write(
    testPowerupDir.append("/server-template.ts"),
    `export default (vars: Record<string, string>) => \`const port = \${vars.serverPort};\`;`,
  );

  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "test powerup for read-create flow",
    variables: { required: [] },
    intent: ["test"],
    steps: [
      {
        type: "read",
        name: "read-config",
        path: "config.json",
        as: "serverPort",
        jsonPath: "port",
      },
      {
        type: "create",
        name: "create-server",
        template: "server-template.ts",
        outputPath: "server.ts",
      },
    ],
  };

  await runPowerup({
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    instructions,
    isDryRun: true,
    variables: {},
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
  });

  assert(await fs.exists(testPowerupDir.append("/manifest.jsonl"))).false();
  assert(await testDestinationDir.append("/server.ts").exists()).false();
  assert(await testDestinationDir.append("/config.json").exists()).true();

  await cleanup();
});

test.case("create then delete flow removes file and writes manifest with both entries", async assert => {
  await setupTestDir();

  await fs.write(
    testPowerupDir.append("/component-template.ts"),
    `export default (vars: Record<string, string>) => \`export const \${vars.name} = "hello";\`;`,
  );

  const instructions: Instructions = {
    name: "test-powerup",
    type: "multi-use",
    description: "test powerup for create-delete flow",
    variables: { required: [] },
    intent: ["test"],
    steps: [
      {
        type: "create",
        name: "create-component",
        template: "component-template.ts",
        outputPath: "component.ts",
      },
      {
        type: "delete",
        name: "delete-component",
        outputPath: "component.ts",
      },
    ],
  };

  await runPowerup({
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    instructions,
    isDryRun: false,
    variables: { name: "MyComponent" },
    powerupVersion: "1.0.0",
    powerupLocation: "test-location",
  });

  assert(await testDestinationDir.append("/component.ts").exists()).false();

  const manifestPath = testPowerupDir.append("/manifest.jsonl");
  assert(await fs.exists(manifestPath)).true();

  const entries = await manifestPath.json() as unknown as ManifestEntry[];
  assert(entries.length).equals(2);
  assert(entries[0].stepType).equals("create");
  assert(entries[0].status).equals("applied");
  assert(entries[1].stepType).equals("delete");
  assert(entries[1].status).equals("applied");

  await cleanup();
});