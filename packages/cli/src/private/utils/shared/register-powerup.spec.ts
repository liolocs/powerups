import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import registerPowerup from "#utils/shared/register-powerup";
import { readConfig, readGlobalConfig } from "#utils/config";
import { CLI_FOLDER_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupLocalTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );
}

async function setupGlobalTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should add the config entry to the local config.json when registering locally", async assert => {
  await setupLocalTestDir();

  await registerPowerup({
    configEntry: "internal:my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  assert(config).defined();
  assert(config!.packages.some(p => p === "internal:my-powerup")).true();

  await cleanup();
});

test.case("should add the config entry to the global config.json when registering globally", async assert => {
  await setupGlobalTestDir();

  await registerPowerup({
    configEntry: "npm:pkg",
    isLocal: false,
    projectRoot: testRoot,
    homeDir: testRoot.path,
  });

  const config = await readGlobalConfig(testRoot.path);
  assert(config).defined();
  assert(config!.packages.some(p => p === "npm:pkg")).true();

  await cleanup();
});

test.case("should not duplicate the entry if already registered", async assert => {
  await setupLocalTestDir();

  await registerPowerup({
    configEntry: "internal:my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  await registerPowerup({
    configEntry: "internal:my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  const count = config!.packages.filter(p => p === "internal:my-powerup").length;
  assert(count).equals(1);

  await cleanup();
});

test.case("should do nothing if the local config.json does not exist", async assert => {
  await setupLocalTestDir();

  await testRoot.append(`/${CLI_FOLDER_NAME}/config.json`).remove();

  let threw = false;
  try {
    await registerPowerup({
      configEntry: "internal:my-powerup",
      isLocal: true,
      projectRoot: testRoot,
    });
  } catch {
    threw = true;
  }
  assert(threw).false();

  await cleanup();
});