import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import getPackageManagerToUse from "#utils/use/run-powerup/steps/run-install-step/get-package-manager-to-use";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const destinationRoot = root.append("/tmp/get-package-manager-to-use");

async function setupTestDir(): Promise<void> {
  await destinationRoot.remove();
  await fs.create(destinationRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should return npm if no package manager is found at destination and auto is used", async assert => {
  await setupTestDir();

  const result = await getPackageManagerToUse({
    packageManager: "auto",
    destination: destinationRoot,
  });

  assert(result).equals("npm");

  await cleanup();
});

test.case("should return the found package manager if auto is used", async assert => {
  await setupTestDir();

  const packageManagers = {
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lock",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  for (const [packageManager, lockFile] of Object.entries(packageManagers)) {
    await fs.write(destinationRoot.append("/" + lockFile), "");

    const result = await getPackageManagerToUse({
      packageManager: "auto",
      destination: destinationRoot,
    });

    assert(result).equals(packageManager);

    await destinationRoot.append("/" + lockFile).remove();
  }

  await cleanup();
});

test.case("should the found package manager even if package manager is specified", async assert => {
  await setupTestDir();

  const packageManagers = {
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lock",
    yarn: "yarn.lock",
    npm: "package-lock.json",
  };

  for (const [packageManager, lockFile] of Object.entries(packageManagers)) {
    await fs.write(destinationRoot.append("/" + lockFile), "");

    const result = await getPackageManagerToUse({
      packageManager: "bun",
      destination: destinationRoot,
    });

    assert(result).equals(packageManager);

    await destinationRoot.append("/" + lockFile).remove();
  }

  await cleanup();
});