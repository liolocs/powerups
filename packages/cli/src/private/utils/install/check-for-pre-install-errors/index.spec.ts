import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import checkForPreInstallErrors from "#utils/install/check-for-pre-install-errors/index";
import { InstallErrorCode } from "#errors/installErrors";
import { CLI_FOLDER_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function setupGlobalTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should throw missing_source when no source is passed", async assert => {
  await setupTestDir();

  await assert(checkForPreInstallErrors({
    source: undefined,
    parsedType: "internal",
    name: "my-powerup",
  })).throwsAsync(InstallErrorCode.missing_source);

  await cleanup();
});

test.case("should throw internal_not_installable when a bare name is not in the global config", async assert => {
  await setupTestDir();

  await assert(checkForPreInstallErrors({
    source: "my-pup",
    parsedType: "internal",
    name: "my-pup",
    homeDir: testRoot.path,
  })).throwsAsync(InstallErrorCode.internal_not_installable);

  await cleanup();
});

test.case("should throw global_internal_not_installable when a bare name is already registered in the global config", async assert => {
  await setupGlobalTestDir();

  await fs.write(
    testRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: ["internal:my-pup"] }) + "\n",
  );

  await assert(checkForPreInstallErrors({
    source: "my-pup",
    parsedType: "internal",
    name: "my-pup",
    homeDir: testRoot.path,
  })).throwsAsync(InstallErrorCode.global_internal_not_installable);

  await cleanup();
});

test.case("should not throw when source type is npm", async assert => {
  await setupTestDir();

  await assert(checkForPreInstallErrors({
    source: "npm:pkg",
    parsedType: "npm",
    name: "pkg",
    homeDir: testRoot.path,
  })).noErrorAsync();

  await cleanup();
});

test.case("should not throw when source type is git", async assert => {
  await setupTestDir();

  await assert(checkForPreInstallErrors({
    source: "git:github.com/owner/repo",
    parsedType: "git",
    name: "repo",
    homeDir: testRoot.path,
  })).noErrorAsync();

  await cleanup();
});