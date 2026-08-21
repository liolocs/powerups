import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import create from "#commands/create/index";
import { CreateErrorCode } from "#errors/createErrors";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import { type Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const realCreatePowerupDir = root.append("/.powerups/installed/_internal/create-powerup");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);

  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}`));

  const targetCreatePowerupDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/create-powerup`,
  );
  await fs.create(targetCreatePowerupDir);

  await copyCreatePowerupAssets(targetCreatePowerupDir);

  await fs.writeJSON(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    { packages: ["internal:create-powerup"] },
  );
}

async function copyCreatePowerupAssets(targetDir: import("@rcompat/fs").FileRef): Promise<void> {
  const distDir = targetDir.append("/dist");
  await fs.create(distDir);

  const instructionsJson = await realCreatePowerupDir.append("/dist/instructions.json").json() as Instructions;
  await fs.writeJSON(distDir.append("/instructions.json"), instructionsJson);

  const packageJson = await realCreatePowerupDir.append("/package.json").json();
  await fs.writeJSON(targetDir.append("/package.json"), packageJson);

  const templatesDir = targetDir.append("/templates");
  await fs.create(templatesDir);

  const templateFiles = [
    "powerup-index.ts",
    "powerup-package.ts",
    "powerup-tsconfig.ts",
    "gitignore.ts",
  ];

  for (const templateFile of templateFiles) {
    const content = await realCreatePowerupDir.append(`/templates/${templateFile}`).text();
    await fs.write(templatesDir.append(`/${templateFile}`), content);
  }
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
      { flag: "--local", value: "" },
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
      { flag: "--local", value: "" },
      { flag: "--dry-run", value: "" },
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
      { flag: "--local", value: "" },
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
      { flag: "--local", value: "" },
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
      { flag: "--local", value: "" },
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
      { flag: "--local", value: "" },
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
      { flag: "--local", value: "" },
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