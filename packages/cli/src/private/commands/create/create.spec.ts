import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import create from "#commands/create/index";
import { CreateErrorCode } from "#errors/createErrors";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

/**
 * Minimal scaffold for the output dir the `create` command writes into.
 *
 * Note: `create` resolves `create-powerup` via getBuiltInPowerup (a built-in
 * that ships with the CLI and is resolved relative to the CLI package, not the
 * project), so the test no longer needs to copy create-powerup into testRoot or
 * register it in a config.json. The built-in's dist is produced by
 * `npm run build:builtins`.
 */
async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}`));
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should create a new local powerup without errors", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
    ],
    context: { root: testRoot },
  })).noErrorAsync();

  const createdPowerupDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-pup`,
  );

  assert(await fs.exists(createdPowerupDir.append("/index.ts"))).true();
  assert(await fs.exists(createdPowerupDir.append("/package.json"))).true();
  assert(await fs.exists(createdPowerupDir.append("/tsconfig.json"))).true();
  assert(await fs.exists(createdPowerupDir.append("/.gitignore"))).true();

  await cleanup();
});

test.case("should not create any files in dry-run mode", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
      { flag: "--dry-run" },
    ],
    context: { root: testRoot },
  })).noErrorAsync();

  const createdPowerupDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-pup`,
  );

  assert(await fs.exists(createdPowerupDir)).false();

  await cleanup();
});

test.case("should throw missing_name when no powerup name is passed as subcommand", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: [],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
    ],
    context: { root: testRoot },
  })).throwsAsync(CreateErrorCode.missing_name);

  await cleanup();
});

test.case("should throw missing_description when description flag is not passed", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--local" },
    ],
    context: { root: testRoot },
  })).throwsAsync(CreateErrorCode.missing_description);

  await cleanup();
});

test.case("should throw invalid_capture when an invalid capture value is passed", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
      { flag: "--capture", value: "bad-value" },
    ],
    context: { root: testRoot },
  })).throwsAsync(CreateErrorCode.invalid_capture);

  await cleanup();
});

test.case("should throw already_exists when the powerup directory already exists", async assert => {
  await setupTestDir();

  const existingPowerupDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-pup`,
  );
  await fs.create(existingPowerupDir);

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
    ],
    context: { root: testRoot },
  })).throwsAsync(CreateErrorCode.already_exists);

  await cleanup();
});

test.case("should create a powerup with type multi-use when --type flag is passed", async assert => {
  await setupTestDir();

  await assert(create.run({
    subcommands: ["test-pup"],
    flags: [
      { flag: "--description", value: "test description" },
      { flag: "--local" },
      { flag: "--type", value: "multi-use" },
    ],
    context: { root: testRoot },
  })).noErrorAsync();

  const indexContent = await testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-pup/index.ts`,
  ).text();

  assert(indexContent).includes('"multi-use"');

  await cleanup();
});