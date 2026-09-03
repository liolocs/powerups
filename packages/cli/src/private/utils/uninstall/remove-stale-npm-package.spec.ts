import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";
import removeStaleNpmPackage from "#utils/uninstall/remove-stale-npm-package";
import { INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/remove-stale-npm-package-test");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

const parsedSource: ParsedSource = {
  type: "npm",
  configEntry: "npm:powerup-hello-world",
  storePath: `${INSTALLED_FOLDER.npm}/node_modules/powerup-hello-world`,
};

test.case("should remove the stale package from the npm store", async assert => {
  await setupTestDir();

  const npmDir = testRoot.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups", private: true, dependencies: { "powerup-hello-world": "latest" },
  });

  await removeStaleNpmPackage({
    powerupDir: testRoot,
    parsedSource,
    isLocal: true,
    isDryRun: false,
    projectRoot: testRoot,
    homeDir: testRoot.path,
  });

  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;
  assert(pkgJson.dependencies?.["powerup-hello-world"]).undefined();

  await cleanup();
});

test.case("should not modify the store in dry-run mode", async assert => {
  await setupTestDir();

  const npmDir = testRoot.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups", private: true, dependencies: { "powerup-hello-world": "latest" },
  });

  const output = await captureStdout(() => removeStaleNpmPackage({
    powerupDir: testRoot,
    parsedSource,
    isLocal: true,
    isDryRun: true,
    projectRoot: testRoot,
    homeDir: testRoot.path,
  }));

  assert(output).includes("dry-run");
  assert(output).includes("Would uninstall powerup-hello-world");

  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;
  assert(pkgJson.dependencies?.["powerup-hello-world"]).equals("latest");

  await cleanup();
});