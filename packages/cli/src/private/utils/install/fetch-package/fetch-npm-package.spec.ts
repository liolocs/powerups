import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import fetchNpmPackage from "#utils/install/fetch-package/fetch-npm-package";
import { InstallErrorCode } from "#errors/installErrors";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should create the npm store directory with package.json if it does not exist", async assert => {
  await setupTestDir();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);

  const parsedSource: ParsedSource = {
    type: "npm",
    configEntry: "npm:@liolocs/powerup-hello-world",
    storePath: `${INSTALLED_FOLDER.npm}/node_modules/@liolocs/powerup-hello-world`,
  };

  await assert(fetchNpmPackage({ powerupDir, parsedSource })).noErrorAsync();

  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);
  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;

  assert(pkgJson.name).equals("powerups");
  assert(pkgJson.private).true();
  assert(pkgJson.dependencies["@liolocs/powerup-hello-world"]).equals("latest");

  await cleanup();
});

test.case("should create a .gitignore in the npm store directory", async assert => {
  await setupTestDir();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);

  const parsedSource: ParsedSource = {
    type: "npm",
    configEntry: "npm:@liolocs/powerup-hello-world",
    storePath: `${INSTALLED_FOLDER.npm}/node_modules/@liolocs/powerup-hello-world`,
  };

  await assert(fetchNpmPackage({ powerupDir, parsedSource })).noErrorAsync();

  const gitignoreContent = await powerupDir.append(`/${INSTALLED_FOLDER.npm}/.gitignore`).text();
  assert(gitignoreContent).includes("*\n!.gitignore\n");

  await cleanup();
});

test.case("should not overwrite an existing package.json in the npm store", async assert => {
  await setupTestDir();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);
  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);

  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups",
    private: true,
    dependencies: { "@liolocs/powerup-hello-world": "latest" },
  });

  const parsedSource: ParsedSource = {
    type: "npm",
    configEntry: "npm:@liolocs/powerup-hello-world",
    storePath: `${INSTALLED_FOLDER.npm}/node_modules/@liolocs/powerup-hello-world`,
  };

  await assert(fetchNpmPackage({ powerupDir, parsedSource })).noErrorAsync();

  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;
  assert(pkgJson.dependencies["@liolocs/powerup-hello-world"]).equals("latest");
  assert(Object.keys(pkgJson.dependencies).length).equals(1);

  await cleanup();
});

test.case("should throw stale_npm_package when a stale dependency blocks npm install", async assert => {
  await setupTestDir();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);
  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);

  // Pre-seed the shared manifest with a stale, non-existent package (left over
  // from a previous failed install) alongside the package we actually want.
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups",
    private: true,
    dependencies: {
      "this-package-does-not-exist-on-npm-xyz123": "latest",
      "@liolocs/powerup-hello-world": "latest",
    },
  });

  const parsedSource: ParsedSource = {
    type: "npm",
    configEntry: "npm:@liolocs/powerup-hello-world",
    storePath: `${INSTALLED_FOLDER.npm}/node_modules/@liolocs/powerup-hello-world`,
  };

  await assert(fetchNpmPackage({ powerupDir, parsedSource }))
    .throwsAsync(InstallErrorCode.stale_npm_package);

  await cleanup();
});