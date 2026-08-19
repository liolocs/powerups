import { UseErrorCode } from "#errors/useErrors";
import test from "#test-utils/test/index";
import getPowerupInstallFromConfig from "#utils/use/get-powerup/getPowerupInstallFromConfig";
import { type PowerupConfig } from "@liolocs/powerups-sdk";
import runtime from "@rcompat/runtime";

const testRoot = (await runtime.projectRoot()).append("/tmp/test-dir");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await testRoot.create();
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should give not in config error if powername is not in config", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: ["internal:test-powerup"],
  };
  await configRef.writeJSON(config);

  await assert(getPowerupInstallFromConfig({ powerupName: "not-in-config", configRef })).throwsAsync(UseErrorCode.not_in_config);

  await cleanup();
});

test.case("should give an invalid config file if the config is invalid", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  await configRef.write("not a valid config");

  await assert(getPowerupInstallFromConfig({ powerupName: "not-in-config", configRef })).throwsAsync(UseErrorCode.config_invalid_file);

  await cleanup();
});

test.case("should return an error if the installation type is not supported", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: ["random:test-powerup"],
  };
  await configRef.writeJSON(config);

  await assert(getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef })).throwsAsync(UseErrorCode.unsupported_package_type);

  await cleanup();
});

test.case("should return the appropriate installation type for an internal package", async assert => {
  await setupTestDir();
  const installationTypes = ["internal", "npm", "git"];

  for (const type of installationTypes) {
    const configRef = testRoot.append(`/config.json`);
    const config: PowerupConfig = {
      packages: [`${type}:test-powerup`],
    };
    await configRef.writeJSON(config);

    await assert(getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef })).noErrorAsync();
    const powerup = await getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef })
    assert(powerup.where).equals(type);
  }

  await cleanup();
});

