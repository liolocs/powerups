import { CLI_FOLDER_NAME } from "#constants";
import { UseErrorCode } from "#errors/useErrors";
import test from "#test-utils/test/index";
import checkForPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/index";
import runtime from "@rcompat/runtime";

const testRoot = (await runtime.projectRoot()).append("/tmp/test-dir");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await testRoot.create();
}

test.case("should throw an error if the config is missing", async assert => {
  await setupTestDir();

  await assert(checkForPowerupInConfig({
    cwd: testRoot,
    powerupName: "test-powerup",
  })).throwsAsync(UseErrorCode.config_not_found);
});

test.case("should throw an error if the powerup is not in the config", async assert => {
  await setupTestDir();

  await testRoot.append(`/${CLI_FOLDER_NAME}/config.json`).writeJSON({ packages: [] });

  await assert(checkForPowerupInConfig({
    cwd: testRoot,
    powerupName: "test-powerup",
  })).throwsAsync(UseErrorCode.not_in_config);
});