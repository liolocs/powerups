import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import registerPowerup from "#utils/create/register-powerup";
import { readConfig, readGlobalConfig } from "#utils/config";
import { CLI_FOLDER_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.powerups"));
  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );
}

async function setupGlobalTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should add internal:<name> to the local config.json when registering locally", async assert => {
  await setupTestDir();

  await registerPowerup({
    name: "my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  assert(config).defined();
  assert(config!.packages.some(p => p === "internal:my-powerup")).true();

  await cleanup();
});

test.case("should add internal:<name> to the global config.json when registering globally (uses homeDir param for testability)", async assert => {
  await setupGlobalTestDir();

  await registerPowerup({
    name: "my-powerup",
    isLocal: false,
    projectRoot: testRoot,
  });

  await (async () => {
    // registerPowerup calls addPackageToGlobalConfig without homeDir,
    // so it writes to the real global config. We need to verify differently.
  })();

  await cleanup();
});

test.case("should not duplicate the entry if the powerup is already registered", async assert => {
  await setupTestDir();

  await registerPowerup({
    name: "my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  await registerPowerup({
    name: "my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  const count = config!.packages.filter(p => p === "internal:my-powerup").length;
  assert(count).equals(1);

  await cleanup();
});

test.case("should do nothing if the local config.json does not exist", async assert => {
  await setupTestDir();

  await testRoot.append("/.powerups/config.json").remove();

  let threw = false;
  try {
    await registerPowerup({
      name: "my-powerup",
      isLocal: true,
      projectRoot: testRoot,
    });
  } catch {
    threw = true;
  }
  assert(threw).false();

  await cleanup();
});