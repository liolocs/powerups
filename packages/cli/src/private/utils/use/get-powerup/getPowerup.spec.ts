import test from "#test-utils/test/index";
import getPowerup from "#utils/use/get-powerup/getPowerup";
import { UseErrorCode } from "#errors/useErrors";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import { createSimpleGlobalScaffoldPowerupForTest, createSimpleScaffoldPowerupForTest } from "#test-utils/create-fully-built-powerup-for-test";
import { CLI_FOLDER_NAME, PACKAGE_JSON } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const globalRoot = root.append("/global-tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await globalRoot.remove();
  await fs.create(testRoot);
  await fs.create(globalRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
  await globalRoot.remove();
}

test.case("should return an error if the package.json is missing from the powerup", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { packageDir, targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });
  await packageDir.append(`/${PACKAGE_JSON}`).remove();

  await assert(getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) })).throwsAsync(UseErrorCode.package_json_error);

  await cleanup();
});

test.case("should return an error if the config file is missing both locally and globally", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleGlobalScaffoldPowerupForTest({ powerupName, testRoot, globalRoot });
  await targetDir.append(`/${CLI_FOLDER_NAME}/config.json`).remove();
  await globalRoot.append(`/${CLI_FOLDER_NAME}/config.json`).remove();

  await assert(getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) })).throwsAsync(UseErrorCode.not_installed);

  await cleanup();
});

test.case("should not return an error if the powerup is local and mentioned in the local config file and no ~/.powerups folder exists", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) })).noErrorAsync()
  assert((await getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) })).instructions.name).equals(powerupName)

  await cleanup();
});

test.case("should not return an error if the config file is missing locally but present globally", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleGlobalScaffoldPowerupForTest({ powerupName, testRoot, globalRoot });

  await assert(getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) })).noErrorAsync()

  await cleanup();
});

test.case("should return the found powerup if it is present locally", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  let threw = false;
  try {
    const powerup = await getPowerup({ cwd: targetDir, name: powerupName, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`) });

    assert(powerup.instructions.name).equals("test-powerup");
  } catch {
    threw = true;
  }
  assert(threw).false();

  await cleanup();
});

test.case("should return the found powerup if it is not present locally but present globally", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleGlobalScaffoldPowerupForTest({ powerupName, testRoot, globalRoot });

  let threw = false;
  try {
    const powerup = await getPowerup({ cwd: targetDir, globalPowerupsDir: globalRoot.append(`/${CLI_FOLDER_NAME}`), name: powerupName });

    assert(powerup.instructions.name).equals("test-powerup");
  } catch {
    threw = true;
  }
  assert(threw).false();

  await cleanup();
});