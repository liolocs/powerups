import { CLI_FOLDER_NAME } from "#constants";
import { UseErrorCode } from "#errors/useErrors";
import test from "#test-utils/test/index";
import checkForPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/index";
import runtime from "@rcompat/runtime";

const testRoot = (await runtime.projectRoot()).append("/tmp/test-dir");
const globalRoot = (await runtime.projectRoot()).append("/tmp/global-test-dir/.powerups");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await globalRoot.remove();
  await testRoot.create();
  await globalRoot.create();
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
  await globalRoot.remove();
}

test.case("should throw an error if the config file is missing globally", async assert => {
  await setupTestDir();

  await assert(checkForPowerupInConfig({
    cwd: testRoot,
    globalRoot,
    powerupName: "test-powerup",
  })).throwsAsync(UseErrorCode.global_config_not_found);

  await cleanup();
});

test.case("should throw an error if the powerup is not in the local or global config", async assert => {
  await setupTestDir();

  await testRoot.append(`/${CLI_FOLDER_NAME}/config.json`).writeJSON({ packages: [] });
  await globalRoot.append("/config.json").writeJSON({ packages: [] });

  await assert(checkForPowerupInConfig({
    cwd: testRoot,
    globalRoot,
    powerupName: "test-powerup",
  })).throwsAsync(UseErrorCode.not_installed);
});

// test.case("should throw an error if the config is missing globally", async assert => {
//   await setupTestDir();
//   await testRoot.append(`/${CLI_FOLDER_NAME}/config.json`).writeJSON({ packages: [] });

//   await assert(checkForPowerupInConfig({
//     cwd: testRoot,
//     powerupName: "test-powerup",
//   })).throwsAsync(UseErrorCode.config_not_found);
// });

// test.case("should throw an error if the powerup is not in the global config", async assert => {
//   await setupTestDir();

//   await testRoot.append(`/${CLI_FOLDER_NAME}/config.json`).writeJSON({ packages: [] });

//   await assert(checkForPowerupInConfig({
//     cwd: testRoot,
//     powerupName: "test-powerup",
//   })).throwsAsync(UseErrorCode.not_in_config);
// });