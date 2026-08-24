import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import install from "#commands/install/index";
import { InstallErrorCode } from "#errors/installErrors";
import { CLI_FOLDER_NAME, FOLDER_FOR_NPM_INSTALLED_PACKAGES, FOLDER_FOR_GIT_INSTALLED_PACKAGES } from "#constants";
import createSimpleProjectForTest from "#test-utils/create-simple-project-for-test";

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

test.case("should throw global_internal_not_installable when installing a global internal powerup", async assert => {
  await setupTestDir();

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: ["internal:global-test-powerup"] }) + "\n",
  );

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "new-project",
    testRoot,
  });

  await assert(install.run({
    subcommands: ["global-test-powerup"],
    flags: [{ flag: "--local", value: "" }],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(InstallErrorCode.global_internal_not_installable);

  await cleanup();
});

test.case("should install a powerup from npm locally without errors", async assert => {
  await setupTestDir();
  const powerupName = "npm:@liolocs/powerup-hello-world";
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [powerupName],
    flags: [{ flag: "--local", value: "" }],
    context: { root: projectDir },
  })).noErrorAsync();

  const localNpmPowerupDir = projectDir.append(
    `/${CLI_FOLDER_NAME}/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/@liolocs/powerup-hello-world`,
  );

  assert(await fs.exists(localNpmPowerupDir)).true();

  const localConfig = await projectDir.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

  assert(localConfig.packages.includes(powerupName)).true();

  await cleanup();
});

test.case("should install a powerup from npm globally without errors", async assert => {
  await setupTestDir();
  const powerupName = "npm:@liolocs/powerup-hello-world";
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [powerupName],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  const globalNpmPowerupDir = globalTestRoot.append(
    `/${CLI_FOLDER_NAME}/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/@liolocs/powerup-hello-world`,
  );

  assert(await fs.exists(globalNpmPowerupDir)).true();

  const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

  assert(globalConfig.packages.includes(powerupName)).true();

  await cleanup();
});

test.case("should install a powerup from git locally without errors", async assert => {
  await setupTestDir();
  const powerupName = "git:github.com/liolocs/powerup-hello-world";
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [powerupName],
    flags: [{ flag: "--local", value: "" }],
    context: { root: projectDir },
  })).noErrorAsync();

  const localGitPowerupDir = projectDir.append(
    `/${CLI_FOLDER_NAME}/${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/github.com/liolocs/powerup-hello-world`,
  );

  assert(await fs.exists(localGitPowerupDir)).true();

  const localConfig = await projectDir.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

  assert(localConfig.packages.includes(powerupName)).true();

  await cleanup();
});

test.case("should install a powerup from git globally without errors", async assert => {
  await setupTestDir();
  const powerupName = "git:github.com/liolocs/powerup-hello-world";
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [powerupName],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  const globalGitPowerupDir = globalTestRoot.append(
    `/${CLI_FOLDER_NAME}/${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/github.com/liolocs/powerup-hello-world`,
  );

  assert(await fs.exists(globalGitPowerupDir)).true();

  const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;

  assert(globalConfig.packages.includes(powerupName)).true();

  await cleanup();
});

test.case("should not fetch or register anything in dry-run mode", async assert => {
  await setupTestDir();
  const powerupName = "npm:@liolocs/powerup-hello-world";
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [powerupName],
    flags: [{ flag: "--dry-run", value: "" }],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  const localNpmPowerupDir = projectDir.append(
    `/${CLI_FOLDER_NAME}/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/@liolocs/powerup-hello-world`,
  );

  assert(await fs.exists(localNpmPowerupDir)).false();

  assert(await fs.exists(projectDir.append(`/${CLI_FOLDER_NAME}/config.json`))).false();

  await cleanup();
});

test.case("should throw missing_source when no source is passed", async assert => {
  await setupTestDir();
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: [],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(InstallErrorCode.missing_source);

  await cleanup();
});

test.case("should throw not_a_powerups_package when installing a non-powerups npm package", async assert => {
  await setupTestDir();
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  await assert(install.run({
    subcommands: ["npm:lodash"],
    flags: [{ flag: "--local", value: "" }],
    context: { root: projectDir },
  })).throwsAsync(InstallErrorCode.not_a_powerups_package);

  await cleanup();
});