import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import install from "#commands/install/install-new";
import { createSimpleScaffoldPowerupForTest } from "#test-utils/create-fully-built-powerup-for-test";
import { InstallErrorCode } from "#errors/installErrors";
import { CLI_FOLDER_NAME, GLOBAL_GIT_PATH, GLOBAL_NPM_PATH, INSTALLED_FOLDER } from "#constants";
import createSimpleProjectForTest from "#test-utils/create-simple-project-for-test";
import createGlobalInternalPowerupForTest from "#test-utils/create-global-internal-powerup-for-test";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const globalTestRoot = root.append("/global-tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await globalTestRoot.remove();
  await fs.create(testRoot);
  await fs.create(globalTestRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
  await globalTestRoot.remove();
}

// test.case("should throw if a global internal powerup is attempted to be installed locally", async assert => {
//   await setupTestDir();

//   const powerupName = "global-test-powerup";
//   await createGlobalInternalPowerupForTest({
//     powerupName,
//     globalRoot: globalTestRoot,
//   });
//   const { projectDir } = await createSimpleProjectForTest({
//     projectName: "new-project",
//     testRoot,
//   });

//   await assert(install.run({
//     subcommands: [powerupName],
//     flags: [{ flag: "--local", value: "" }],
//     context: { root: projectDir },
//   })).throwsAsync(InstallErrorCode.global_internal_not_installable);

//   await cleanup();
// });

// test.case("should install an powerup from npm locally if local flag is passed", async assert => {
//   await setupTestDir();
//   const powerupName = "npm:powerup-hello-world";
//   const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

//   await assert(install.run({
//     subcommands: [powerupName],
//     flags: [{ flag: "--local", value: "" }],
//     context: { root: projectDir },
//   })).noErrorAsync();

//   const localNpmPowerupDir = projectDir.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.npm}/${powerupName}`);

//   assert(await localNpmPowerupDir.exists()).true();

//   const localConfig = await projectDir.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

//   assert(localConfig.packages.includes(powerupName)).true();

//   await cleanup();
// });

// test.case("should install an powerup from npm globally if local flag is NOT passed", async assert => {
//   await setupTestDir();
//   const powerupName = "npm:powerup-hello-world";
//   const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

//   await assert(install.run({
//     subcommands: [powerupName],
//     flags: [],
//     context: { root: projectDir },
//   })).noErrorAsync();

//   const globalNpmPowerupDir = globalTestRoot.append(`/${GLOBAL_NPM_PATH}/${powerupName}`);

//   assert(await globalNpmPowerupDir.exists()).true();

//   const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

//   assert(globalConfig.packages.includes(powerupName)).true();

//   await cleanup();
// });

// test.case("should install an powerup from git locally if local flag is passed", async assert => {
//   await setupTestDir();
//   const powerupName = "test-powerup";
//   const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

//   await assert(install.run({
//     subcommands: [powerupName],
//     flags: [{ flag: "--local", value: "" }],
//     context: { root: projectDir },
//   })).noErrorAsync();

//   const localGitPowerupDir = projectDir.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.git}/${powerupName}`);

//   assert(await localGitPowerupDir.exists()).true();

//   const localConfig = await projectDir.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

//   assert(localConfig.packages.includes(powerupName)).true();

//   await cleanup();
// });

// test.case("should install an powerup from git globally if local flag is NOT passed", async assert => {
//   await setupTestDir();
//   const powerupName = "test-powerup";
//   const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

//   await assert(install.run({
//     subcommands: [powerupName],
//     flags: [],
//     context: { root: projectDir },
//   })).noErrorAsync();

//   const globalGitPowerupDir = globalTestRoot.append(`/${GLOBAL_GIT_PATH}/${powerupName}`);

//   assert(await globalGitPowerupDir.exists()).true();

//   const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

//   assert(globalConfig.packages.includes(powerupName)).true();

//   await cleanup();
// });

// test.case("should throw if user is trying to install a non powerup dir from npm locally", async assert => {
// });

// test.case("should throw if user is trying to install a non powerup dir from npm globally", async assert => {
// });

// test.case("should throw if user is trying to install a non powerup dir from git locally", async assert => {
// });

// test.case("should throw if user is trying to install a non powerup dir from git globally", async assert => {
// });