import test from "#test-utils/test/index";
import getPowerup from "#utils/use/getPowerup/getPowerup";
import { UseErrorCode } from "#errors/useErrors";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import { createSimpleGlobalScaffoldPowerupForTest, createSimpleScaffoldPowerupForTest } from "#test-utils/create-fully-built-powerup-for-test";

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

test.case("should return the found powerup if it is present locally", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const { targetDir } = await createSimpleScaffoldPowerupForTest({ powerupName, testRoot });

  let threw = false;
  try {
    const powerup = await getPowerup({ root: targetDir, name: powerupName });

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
    const powerup = await getPowerup({ root: targetDir, name: powerupName });

    assert(powerup.instructions.name).equals("test-powerup");
  } catch {
    threw = true;
  }
  assert(threw).false();

  await cleanup();
});