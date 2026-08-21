import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import test from "#test-utils/test/index";
import compileIndexFile from "#utils/build/compile-index-file";
import { getPackageJson } from "#utils/build/getPackageJson";
import { BuildErrorCode } from "#errors/buildErrors";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should create a powerup package with correct folder structure", async assert => {
  await setupTestDir();
  await createPowerupPackageForTest({ testRoot });

  const powerupName = "test-powerup";
  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );

  // Required files for a buildable powerup package.
  assert(await packageDir.append("/package.json").exists()).true();
  assert(await packageDir.append("/index.ts").exists()).true();
  assert(await packageDir.append("/tsconfig.json").exists()).true();
  assert(await packageDir.append("/.gitignore").exists()).true();
  assert(await packageDir.append("/templates/component.ts").exists()).true();

  // The package.json must declare itself as a powerups package.
  const pkgJson = await packageDir.append("/package.json").json();
  assert(Array.isArray(pkgJson.keywords)).true();
  assert(pkgJson.keywords.includes("powerups-package")).true();
  assert(pkgJson.powerup.instructions).equals("index.ts");

  // index.ts must default-export defineInstructions(...) — the build validates this.
  const indexSrc = await packageDir.append("/index.ts").text();
  assert(indexSrc.includes("defineInstructions(instructions, import.meta.url)")).true();

  await cleanup();
});

test.case("should create a dist folder with the compiled index file", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const powerupInstructions = await createPowerupPackageForTest({ powerupName, testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );

  await compileIndexFile({ root: packageDir, pkgJson: await getPackageJson(packageDir) });

  assert(await fs.exists(packageDir.append("/dist"))).true();
  assert(await fs.exists(packageDir.append("/dist/index.js"))).true();

  const indexJs = await fs.ref(packageDir.append("/dist/index.js")).import();

  assert(indexJs!.default.instructions.name).equals(powerupName);
  assert(indexJs!.default.instructions.type).equals(powerupInstructions.type);
  assert(indexJs!.default.instructions.description).equals(powerupInstructions.description);

  await cleanup();
});

test.case("should flag when invalid exports are generated for the index file", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  await createPowerupPackageForTest({ powerupName, testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );

  await fs.write(packageDir.append("/index.ts"), "export default 123;");

  const pkgJson = await getPackageJson(packageDir);
  await assert(compileIndexFile({ root: packageDir, pkgJson })).throwsAsync(BuildErrorCode.invalid_instructions_file);

  await cleanup();
});