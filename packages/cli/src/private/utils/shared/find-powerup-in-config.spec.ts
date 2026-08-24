import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";
import type { PackageEntry } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/find-powerup-in-config-test");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

async function writeConfig(entries: PackageEntry[]): Promise<void> {
  await fs.write(
    testRoot.append("/config.json"),
    JSON.stringify({ packages: entries }) + "\n",
  );
}

test.case("should return the entry when a powerup name matches a string entry", async assert => {
  await setupTestDir();
  await writeConfig(["internal:my-powerup"]);

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "my-powerup",
  });

  assert(entry).equals("internal:my-powerup");

  await cleanup();
});

test.case("should return the entry when a powerup name matches an object entry with name field", async assert => {
  await setupTestDir();
  await writeConfig([{ package: "npm:@liolocs/pkg", name: "my-powerup" }]);

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "my-powerup",
  });

  assert(entry).equals({ package: "npm:@liolocs/pkg", name: "my-powerup" });

  await cleanup();
});

test.case("should return the entry when a powerup name matches an object entry without name field (legacy)", async assert => {
  await setupTestDir();
  await writeConfig([{ package: "npm:my-powerup" }]);

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "my-powerup",
  });

  assert(entry).equals({ package: "npm:my-powerup" });

  await cleanup();
});

test.case("should return null when the powerup name is not in config", async assert => {
  await setupTestDir();
  await writeConfig(["internal:other-powerup"]);

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "nonexistent",
  });

  assert(entry).equals(null);

  await cleanup();
});

test.case("should return null when the config file does not exist", async assert => {
  await setupTestDir();

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "my-powerup",
  });

  assert(entry).equals(null);

  await cleanup();
});

test.case("should return null when the config file is invalid", async assert => {
  await setupTestDir();
  await fs.write(testRoot.append("/config.json"), "not valid json");

  const entry = await findPowerupInConfig({
    configRef: testRoot.append("/config.json"),
    powerupName: "my-powerup",
  });

  assert(entry).equals(null);

  await cleanup();
});