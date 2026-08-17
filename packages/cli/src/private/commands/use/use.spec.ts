import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import use from "#commands/use/use-new";
import { createSimpleScaffoldPowerupForTest } from "#test-utils/create-fully-built-powerup-for-test";
import { UseErrorCode } from "#errors/useErrors";

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
    subcommands: ["test-powerup"],
    flags: [],
    context: { root: targetDir },
  })).noErrorAsync();

  await cleanup();
});

test.case("should not create any files anything with dry run flag", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { packageDir, targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: ["test-powerup"],
    flags: [{ flag: "-dr", value: "" }],
    context: { root: targetDir },
  })).noErrorAsync();

  assert(await targetDir.append("/package.json").exists()).false();

  await cleanup();
});

test.case("should use the powerup according to the instructions without any errors", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { packageDir, targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await use.run({
    subcommands: ["test-powerup"],
    flags: [],
    context: { root: targetDir },
  });
});

test.case("should give an error if a powerup name was not passed", async assert => {
  await setupTestDir();
  const powerupName = "simple-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  await assert(use.run({
    subcommands: [],
    flags: [],
    context: { root: targetDir },
  })).throwsAsync(UseErrorCode.missing_name);
});
