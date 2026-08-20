import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import use from "#commands/use/index";
import { createSimpleScaffoldPowerupForTest } from "#test-utils/create-fully-built-powerup-for-test";
import { UseErrorCode } from "#errors/useErrors";
import { CLI_FOLDER_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should use a fully-built powerup without errors", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: [powerupName],
    flags: [{ flag: "--name", value: "name-value-required-from-powerup" }],
    context: { root: targetDir },
  })).noErrorAsync();

  await cleanup();
});

test.case("should not create any files anything with dry run flag", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: [powerupName],
    flags: [
      { flag: "-dr", value: "" },
      { flag: "--name", value: "name-value-required-from-powerup" },
    ],
    context: { root: targetDir },
  })).noErrorAsync();

  assert(await targetDir.append("/package.json").exists()).false();

  await cleanup();
});

test.case("should use the powerup according to the instructions without any errors", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await use.run({
    subcommands: [powerupName],
    flags: [{ flag: "--name", value: "name-value-required-from-powerup" }],
    context: { root: targetDir },
  });

  await cleanup();
});

test.case("should give an error if a powerup name was not passed", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "name-value-required-from-powerup" }],
    context: { root: targetDir },
  })).throwsAsync(UseErrorCode.missing_name);

  await cleanup();
});

test.case("should give an error if the config file is missing", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await targetDir.append(`/${CLI_FOLDER_NAME}/config.json`).remove();

  await assert(use.run({
    subcommands: [powerupName],
    flags: [{ flag: "--name", value: "name-value-required-from-powerup" }],
    context: { root: targetDir },
  })).throwsAsync(UseErrorCode.not_installed);

  await cleanup();
});

test.case("should give an error if the powerup is not in the config", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: ["test-powerup"],
    flags: [{ flag: "--name", value: "name-value-required-from-powerup" }],
    context: { root: targetDir },
  })).throwsAsync(UseErrorCode.not_installed);

  await cleanup();
});