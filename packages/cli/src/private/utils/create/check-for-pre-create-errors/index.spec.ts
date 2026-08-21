import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import checkForPreCreateErrors from "#utils/create/check-for-pre-create-errors/index";
import { CreateErrorCode } from "#errors/createErrors";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.powerups"));
  await fs.create(testRoot.append("/.powerups/installed/_internal"));
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should throw missing_name when no powerup name is passed", async assert => {
  await setupTestDir();

  try {
    await checkForPreCreateErrors({
      powerupName: undefined,
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.missing_name);
  }

  await cleanup();
});

test.case("should throw invalid_capture when an invalid capture value is passed", async assert => {
  await setupTestDir();

  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      captureValue: "bad-value",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.invalid_capture);
  }

  await cleanup();
});

test.case("should not throw when capture value is all", async assert => {
  await setupTestDir();

  let threw = false;
  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      captureValue: "all",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(false);

  await cleanup();
});

test.case("should not throw when capture value is workingDir", async assert => {
  await setupTestDir();

  let threw = false;
  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      captureValue: "workingDir",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(false);

  await cleanup();
});

test.case("should not throw when capture flag is not passed (undefined)", async assert => {
  await setupTestDir();

  let threw = false;
  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(false);

  await cleanup();
});

test.case("should throw missing_description when description is not passed", async assert => {
  await setupTestDir();

  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: undefined,
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.missing_description);
  }

  await cleanup();
});

test.case("should throw already_exists when the powerup directory already exists", async assert => {
  await setupTestDir();

  await fs.create(testRoot.append("/.powerups/installed/_internal/test-pup"));

  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.already_exists);
  }

  await cleanup();
});

test.case("should throw main_folder_not_found when local and .powerups/ folder does not exist", async assert => {
  await setupTestDir();

  await testRoot.append("/.powerups").remove();

  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.main_folder_not_found);
  }

  await cleanup();
});

test.case("should throw global_root_not_found when global and global root does not exist", async assert => {
  await setupTestDir();

  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: "test description",
      isLocal: false,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/nonexistent-global"),
    });
    assert(true).equals(false);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.global_root_not_found);
  }

  await cleanup();
});

test.case("should pass when all checks succeed", async assert => {
  await setupTestDir();

  let threw = false;
  try {
    await checkForPreCreateErrors({
      powerupName: "test-pup",
      description: "test description",
      isLocal: true,
      powerupDirectory: testRoot.append("/.powerups/installed/_internal"),
      projectRoot: testRoot,
      globalRoot: testRoot.append("/global"),
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(false);

  await cleanup();
});