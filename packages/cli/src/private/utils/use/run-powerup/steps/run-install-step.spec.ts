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

test.case("should successfully install a package from npm via install step", async assert => {
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
  };
  await assert(runInstallStep({ step, isDryRun: false, destination: destinationRef })).noErrorAsync();

  await cleanup();
});