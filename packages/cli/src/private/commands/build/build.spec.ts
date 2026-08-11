import build from "#commands/build/index";
import { CLI_FOLDER_NAME, INTERNAL_FOLDER } from "#constants";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should build the dist folder if the index.ts is valid", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  await createPowerupPackageForTest({ powerupName, testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );

  await assert(build.run({
    subcommands: [],
    flags: [],
    context: { root: packageDir },
  })).noErrorAsync();

  const distFolder = testRoot.append(`/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}/dist`);

  assert(await fs.exists(distFolder)).true();
  assert(await fs.exists(distFolder.append("/index.js"))).true();
  assert(await fs.exists(distFolder.append("/instructions.json"))).true();

  await cleanup();
});