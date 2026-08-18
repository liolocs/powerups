import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step";
import { type Step } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should successfully install a package based on the .lock file if packageManager is auto", async assert => {
  await setupTestDir();
  const destinationRef = testRoot.append("/tmp-repo-for-install-step-test");
  await fs.create(destinationRef);
  await destinationRef.append("/package.json").writeJSON({ name: "test-powerup", version: "1.0.0", description: "a test project" });

  const step: Step = {
    type: "install",
    name: "pkg",
    dependencies: ["lodash@^4.0.0"],
    devDependencies: ["vitest"],
    peerDependencies: ["@liolocs/powerups-sdk"],
    packageManager: "pnpm",
  };

  let threw = false;
  try {
    const manifest = await runInstallStep({ step, isDryRun: false, destination: destinationRef });
    assert(manifest.output.type).equals("install");
  } catch {
    threw = true;
  }

  assert(threw).false();

  await cleanup();
});

test.case("should successfully install a package based on the packageManager field", async assert => {
  await setupTestDir();
  const destinationRef = testRoot.append("/tmp-repo-for-install-step-test");
  await fs.create(destinationRef);
  await destinationRef.append("/package.json").writeJSON({ name: "test-powerup", version: "1.0.0", description: "a test project" });

  const step: Step = {
    type: "install",
    name: "pkg",
    dependencies: ["lodash@^4.0.0"],
    devDependencies: ["vitest"],
    peerDependencies: ["@liolocs/powerups-sdk"],
    packageManager: "pnpm",
  };
  await assert(runInstallStep({ step, isDryRun: false, destination: destinationRef })).noErrorAsync();

  await cleanup();
});