import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import test from "#test-utils/test/index";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";
import checkForPreBuildErrors from "#utils/build/check-pre-build-errors";
import { BuildErrorCode } from "#errors/buildErrors";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should flag when package.json is missing", async assert => {
  await setupTestDir();
  await createPowerupPackageForTest({ testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-powerup`,
  );
  await packageDir.append("/package.json").remove();

  await assert(checkForPreBuildErrors(packageDir)).throwsAsync(BuildErrorCode.no_package_json);

  await cleanup();
});

test.case("should flag when package.json is missing powerups keyword", async assert => {
  await setupTestDir();
  await createPowerupPackageForTest({ testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-powerup`,
  );
  await packageDir.append("/package.json").writeJSON({
    name: "test-powerup",
    version: "1.0.0",
    description: "a test powerup",
    type: "module",
    scripts: { build: "pup build" },
    files: ["dist"],
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    devDependencies: {
      // /tmp/.powerups/_internal/<powerupName> -> <projectRoot>/packages/sdk
      // is four directories up: <powerupName> -> _internal -> .powerups -> tmp -> <projectRoot>
      "@liolocs/powerups-sdk": "link:../../../../packages/sdk",
    },
  });

  await assert(checkForPreBuildErrors(packageDir)).throwsAsync(BuildErrorCode.not_a_powerups_package);

  await cleanup();
});

test.case("should flag when powerups shape is invalid", async assert => {
  await setupTestDir();
  await createPowerupPackageForTest({ testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-powerup`,
  );
  await packageDir.append("/package.json").writeJSON({
    name: "test-powerup",
    version: "1.0.0",
    description: "a test powerup",
    type: "module",
    scripts: { build: "pup build" },
    keywords: ["powerups-package"],
    powerup: {},
    files: ["dist"],
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    devDependencies: {
      // /tmp/.powerups/_internal/<powerupName> -> <projectRoot>/packages/sdk
      // is four directories up: <powerupName> -> _internal -> .powerups -> tmp -> <projectRoot>
      "@liolocs/powerups-sdk": "link:../../../../packages/sdk",
    },
  });


  await fs.create(packageDir);

  await assert(checkForPreBuildErrors(packageDir)).throwsAsync(BuildErrorCode.malformed_powerup_property);

  await cleanup();
});

test.case("should have no errors when everything is valid", async assert => {
  await setupTestDir();
  await createPowerupPackageForTest({ testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/test-powerup`,
  );

  await assert(checkForPreBuildErrors(packageDir)).noErrorAsync();

  await cleanup();
});