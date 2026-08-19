import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import findPackageManagerAtDestination from "#utils/use/run-powerup/steps/run-install-step/find-package-manager-at-destination";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/find-package-manager-at-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should return the correct package manager", async assert => {
  await setupTestDir();
  const packageManagers = {
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lock",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  for (const [packageManager, lockFile] of Object.entries(packageManagers)) {
    const lockFileRef = testRoot.append(`/${lockFile}`);
    await fs.write(lockFileRef.path, "");

    const result = await findPackageManagerAtDestination(testRoot);

    assert(result).equals(packageManager);

    await lockFileRef.remove();
  }

  await cleanup();
});

test.case("should return none if no packager manager is found at destination", async assert => {
  await setupTestDir();

  const result = await findPackageManagerAtDestination(testRoot);

  assert(result).equals("none");

  await cleanup();
});

test.case("should return none if the destination does not exist", async assert => {
  await setupTestDir();

  const result = await findPackageManagerAtDestination(testRoot.append("/does-not-exist"));

  assert(result).equals("none");

  await cleanup();
});