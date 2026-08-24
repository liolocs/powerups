import test from "#test-utils/test/index";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import validateInstalledPackage from "#utils/install/validate-installed-package";
import { InstallErrorCode } from "#errors/installErrors";
import { SharedErrorCode } from "#errors/sharedErrors";
import { PACKAGE_JSON, PACKAGE_JSON_KEYWORD_PROPERTY } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

async function createPackageDir(options: {
  hasPackageJson?: boolean;
  hasKeyword?: boolean;
  hasDist?: boolean;
  powerupProperty?: Record<string, unknown> | null;
}): Promise<FileRef> {
  const packageDir = testRoot.append("/test-package");
  await fs.create(packageDir);

  if (options.hasPackageJson !== false) {
    const pkgJson: Record<string, unknown> = {
      name: "test-package",
      version: "1.0.0",
    };
    if (options.hasKeyword !== false) {
      pkgJson.keywords = [PACKAGE_JSON_KEYWORD_PROPERTY];
    }
    if (options.powerupProperty !== null && options.powerupProperty !== undefined) {
      pkgJson.powerup = options.powerupProperty;
    } else if (options.powerupProperty !== null) {
      pkgJson.powerup = { instructions: "index.ts" };
    }
    await fs.writeJSON(packageDir.append(`/${PACKAGE_JSON}`), pkgJson as any);
  }

  if (options.hasDist !== false) {
    const distDir = packageDir.append("/dist");
    await fs.create(distDir);
    await fs.write(distDir.append("/instructions.json"), "{}\n");
  }

  return packageDir;
}

test.case("should throw not_a_powerups_package when package.json does not exist", async assert => {
  await setupTestDir();

  const packageDir = await createPackageDir({ hasPackageJson: false });

  await assert(validateInstalledPackage({ packageDir, source: "npm:bad-pkg" }))
    .throwsAsync(InstallErrorCode.not_a_powerups_package);

  await cleanup();
});

test.case("should throw not_a_powerups_package when the powerups-package keyword is missing", async assert => {
  await setupTestDir();

  const packageDir = await createPackageDir({ hasKeyword: false });

  await assert(validateInstalledPackage({ packageDir, source: "npm:bad-pkg" }))
    .throwsAsync(InstallErrorCode.not_a_powerups_package);

  await cleanup();
});

test.case("should throw not_a_powerups_package when dist/instructions.json does not exist", async assert => {
  await setupTestDir();

  const packageDir = await createPackageDir({ hasDist: false });

  await assert(validateInstalledPackage({ packageDir, source: "npm:bad-pkg" }))
    .throwsAsync(InstallErrorCode.not_a_powerups_package);

  await cleanup();
});

test.case("should throw invalid_powerup_property when the powerups property is invalid", async assert => {
  await setupTestDir();

  const packageDir = await createPackageDir({
    powerupProperty: { wrong_field: "bad" },
  });

  await assert(validateInstalledPackage({ packageDir, source: "npm:bad-pkg" }))
    .throwsAsync(SharedErrorCode.invalid_powerup_property);

  await cleanup();
});

test.case("should not throw when the package is valid", async assert => {
  await setupTestDir();

  const packageDir = await createPackageDir({});

  await assert(validateInstalledPackage({ packageDir, source: "npm:good-pkg" }))
    .noErrorAsync();

  await cleanup();
});