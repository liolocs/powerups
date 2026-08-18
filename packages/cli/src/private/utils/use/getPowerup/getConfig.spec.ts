import { UseErrorCode } from "#errors/useErrors";
import test from "#test-utils/test/index";
import { type PowerupConfig } from "@liolocs/powerups-sdk";
import runtime from "@rcompat/runtime";
import { getConfig } from "#utils/use/getPowerup/getConfig";

const testRoot = (await runtime.projectRoot()).append("/tmp/test-dir");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await testRoot.create();
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should give config not found if config is missing", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");

  await assert(getConfig(configRef)).throwsAsync(UseErrorCode.config_not_found);

  await cleanup();
});

test.case("should give an invalid config file if the config is invalid", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");

  await configRef.write("not a valid config");

  await assert(getConfig(configRef)).throwsAsync(UseErrorCode.config_invalid_file);

  await cleanup();
});

test.case("should give the config if it is found", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: ["test-powerup"],
  };
  await configRef.writeJSON(config);

  await assert(getConfig(configRef)).noErrorAsync();

  await cleanup();
});