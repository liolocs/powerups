import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import { type Step } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/use/resolved-variable";

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

  const destinationPackageJson = destinationRef.append("/package.json");
  await destinationPackageJson.writeJSON({ name: "test-powerup", version: "1.0.0", description: "a test project" });

  await fs.write(destinationRef.append("/pnpm-lock.yaml"), "");

  const step: Step = {
    type: "install",
    name: "pkg",
    dependencies: ["lodash@4.0.0"],
    devDependencies: ["vitest"],
    peerDependencies: ["vue"],
    packageManager: "auto",
  };

  let threw = false;
  try {
    const { manifest } = await runInstallStep({ step, isDryRun: false, destination: destinationRef, variables: {} });
    assert(manifest.output.type).equals("install");
    // if statement is for typescript to not give an error
    if (manifest.output.type === "install") {
      assert(manifest.output.packageManager).equals("pnpm");
    }
    const pkgJson = await destinationPackageJson.json() as any;

    assert(pkgJson.dependencies["lodash"]).defined();
    assert(pkgJson.devDependencies["vitest"]).defined();
    assert(pkgJson.peerDependencies["vue"]).defined();
    assert(await destinationRef.append("/pnpm-lock.yaml").exists()).true();
  } catch (e) {
    console.error(e);
    threw = true;
  }

  assert(threw).false();

  await cleanup();
});

test.case("should successfully install packages in the correct locations regardless of the packageManager used", async assert => {

  const packageManagers = {
    pnpm: { lock: "pnpm-lock.yaml", pm: "pnpm@10.33.0" },
    bun: { lock: "bun.lock", pm: "bun@1.2.0" },
    yarn: { lock: "yarn.lock", pm: "yarn@4.18.0" },
    npm: { lock: "package-lock.json", pm: "npm@11.0.0" },
  };

  for (const [packageManager, { lock: lockFile, pm: packageManagerField }] of Object.entries(packageManagers)) {
    await setupTestDir();

    const destinationRef = testRoot.append("/tmp-repo-for-install-step-test");
    await fs.create(destinationRef);

    const destinationPackageJson = destinationRef.append("/package.json");
    await destinationPackageJson.writeJSON({
      name: "test-powerup",
      version: "1.0.0",
      description: "a test project",
      packageManager: packageManagerField,
    });

    await fs.write(destinationRef.append(`/${lockFile}`), "");

    const step: Step = {
      type: "install",
      name: "pkg",
      dependencies: ["lodash"],
      devDependencies: ["vitest"],
      peerDependencies: ["vue"],
      packageManager: "auto",
    };

    let threw = false;
    try {
      const { manifest } = await runInstallStep({ step, isDryRun: false, destination: destinationRef, variables: {} });
      assert(manifest.output.type).equals("install");
      // if statement is for typescript to not give an error
      if (manifest.output.type === "install") {
        assert(manifest.output.packageManager).equals(packageManager);
      }
      const pkgJson = await destinationPackageJson.json() as any;

      assert(pkgJson.dependencies["lodash"]).defined();
      assert(pkgJson.devDependencies["vitest"]).defined();
      assert(pkgJson.peerDependencies["vue"]).defined();
      assert(await destinationRef.append(`/${lockFile}`).exists()).true();
    } catch (e) {
      console.error(e);
      threw = true;
    }

    assert(threw).false();

    await cleanup();
  }
});

test.case("should install into the target subdirectory when target is provided", async assert => {
  await setupTestDir();

  const destinationRef = testRoot.append("/tmp-monorepo");
  await fs.create(destinationRef);

  // The target subdirectory simulates a package inside a monorepo
  const targetDir = destinationRef.append("/packages/my-powerup");
  await fs.create(targetDir);

  const targetPackageJson = targetDir.append("/package.json");
  await targetPackageJson.writeJSON({ name: "my-powerup", version: "1.0.0", description: "a test project" });

  // Root has a pnpm lockfile so auto-detection finds pnpm at the target level
  await fs.write(targetDir.append("/pnpm-lock.yaml"), "");

  const variables: ResolvedVariable = {
    outputPath: "packages",
    name: "my-powerup",
  };

  const step: Step = {
    type: "install",
    name: "deps",
    target: "{{outputPath}}/{{name}}",
    dependencies: ["lodash"],
    packageManager: "auto",
  };

  let threw = false;
  try {
    const { manifest } = await runInstallStep({ step, isDryRun: false, destination: destinationRef, variables });
    assert(manifest.output.type).equals("install");

    // The package should be installed in the target subdirectory, not at the root
    const pkgJson = await targetPackageJson.json() as any;
    assert(pkgJson.dependencies["lodash"]).defined();

    // The root package.json should NOT have the dependency
    const rootPackageJsonExists = await destinationRef.append("/package.json").exists();
    assert(rootPackageJsonExists).false();
  } catch (e) {
    console.error(e);
    threw = true;
  }

  assert(threw).false();

  await cleanup();
});
