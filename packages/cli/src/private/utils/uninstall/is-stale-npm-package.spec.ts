import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import isStaleNpmPackage from "#utils/uninstall/is-stale-npm-package";
import { INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/is-stale-npm-package-test");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

async function writeStorePackageJson(dependencies: Record<string, string>): Promise<void> {
  const npmDir = testRoot.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups", private: true, dependencies,
  });
}

const npmSource: ParsedSource = {
  type: "npm",
  configEntry: "npm:powerup-hello-world",
  storePath: `${INSTALLED_FOLDER.npm}/node_modules/powerup-hello-world`,
};

test.case("should return true when the package is present in the npm store", async assert => {
  await setupTestDir();
  await writeStorePackageJson({ "powerup-hello-world": "latest" });

  assert(await isStaleNpmPackage(testRoot, npmSource)).true();

  await cleanup();
});

test.case("should return false when the package is not in the npm store", async assert => {
  await setupTestDir();
  await writeStorePackageJson({ "@liolocs/other": "latest" });

  assert(await isStaleNpmPackage(testRoot, npmSource)).false();

  await cleanup();
});

test.case("should return false when the npm store has no package.json", async assert => {
  await setupTestDir();
  await fs.create(testRoot.append(`/${INSTALLED_FOLDER.npm}`));

  assert(await isStaleNpmPackage(testRoot, npmSource)).false();

  await cleanup();
});

test.case("should return false for a non-npm source", async assert => {
  await setupTestDir();
  await writeStorePackageJson({ "powerup-hello-world": "latest" });

  const gitSource: ParsedSource = {
    type: "git",
    configEntry: "git:github.com/owner/repo",
    storePath: "installed/git/github.com/owner/repo",
    cloneUrl: "https://github.com/owner/repo",
  };

  assert(await isStaleNpmPackage(testRoot, gitSource)).false();

  await cleanup();
});