import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import uninstall from "#commands/uninstall/index";
import { UninstallErrorCode } from "#errors/uninstallErrors";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
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

test.case("should uninstall a git powerup from global config without errors", async assert => {
  await setupTestDir();

  const source = "git:github.com/owner/my-powerup";
  const powerupName = "my-powerup";

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [{ package: source, name: powerupName }] }) + "\n",
  );

  const gitDir = globalTestRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.git}/github.com/owner/my-powerup`,
  );
  await fs.create(gitDir);
  await fs.write(gitDir.append("/file.txt"), "content");

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: [powerupName],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  assert(await fs.exists(gitDir)).false();

  const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;
  assert(globalConfig.packages.some((p: any) => p.name === powerupName)).false();

  await cleanup();
});

test.case("should uninstall a git powerup from local config without errors", async assert => {
  await setupTestDir();

  const source = "git:github.com/owner/my-powerup";
  const powerupName = "my-powerup";

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await fs.create(projectDir.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    projectDir.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [{ package: source, name: powerupName }] }) + "\n",
  );

  const gitDir = projectDir.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.git}/github.com/owner/my-powerup`,
  );
  await fs.create(gitDir);
  await fs.write(gitDir.append("/file.txt"), "content");

  await assert(uninstall.run({
    subcommands: [powerupName],
    flags: [{ flag: "--local" }],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  assert(await fs.exists(gitDir)).false();

  const localConfig = await projectDir.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;
  assert(localConfig.packages.some((p: any) => p.name === powerupName)).false();

  await cleanup();
});

test.case("should not remove config or files in dry-run mode", async assert => {
  await setupTestDir();

  const source = "git:github.com/owner/my-powerup";
  const powerupName = "my-powerup";

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [{ package: source, name: powerupName }] }) + "\n",
  );

  const gitDir = globalTestRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.git}/github.com/owner/my-powerup`,
  );
  await fs.create(gitDir);
  await fs.write(gitDir.append("/file.txt"), "content");

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: [powerupName],
    flags: [{ flag: "--dry-run" }],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  assert(await fs.exists(gitDir)).true();

  const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;
  assert(globalConfig.packages.some((p: any) => p.name === powerupName)).true();

  await cleanup();
});

test.case("should throw not_installed when the powerup is not in config", async assert => {
  await setupTestDir();

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: ["nonexistent-powerup"],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(UninstallErrorCode.not_installed);

  await cleanup();
});

test.case("should throw internal_not_uninstallable when uninstalling an internal powerup", async assert => {
  await setupTestDir();

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: ["internal:my-powerup"] }) + "\n",
  );

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: ["my-powerup"],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(UninstallErrorCode.internal_not_uninstallable);

  await cleanup();
});

test.case("should throw missing_name when no powerup name is passed", async assert => {
  await setupTestDir();

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: [],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(UninstallErrorCode.missing_name);

  await cleanup();
});

test.case("should uninstall an npm powerup from global config by its full source", async assert => {
  await setupTestDir();

  const source = "npm:@liolocs/powerup-hello-world";
  const powerupName = "hello-world";

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [{ package: source, name: powerupName }] }) + "\n",
  );

  const npmDir = globalTestRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups",
    private: true,
    dependencies: { "@liolocs/powerup-hello-world": "latest" },
  });

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: [source],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  const globalConfig = await globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`).json() as any;
  assert(globalConfig.packages.some((p: any) => p.name === powerupName)).false();

  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;
  assert(pkgJson.dependencies?.["@liolocs/powerup-hello-world"]).undefined();

  await cleanup();
});

test.case("should uninstall a stale npm package that is not registered in config", async assert => {
  await setupTestDir();

  const staleSource = "npm:powerup-hello-world";

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );

  const npmDir = globalTestRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: "powerups", private: true, dependencies: { "powerup-hello-world": "latest" } });

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: [staleSource],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).noErrorAsync();

  const pkgJson = await npmDir.append(`/${PACKAGE_JSON}`).json() as Record<string, any>;
  assert(pkgJson.dependencies?.["powerup-hello-world"]).undefined();

  await cleanup();
});

test.case("should throw not_installed when an npm source is neither in config nor in the npm store", async assert => {
  await setupTestDir();

  await fs.create(globalTestRoot.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    globalTestRoot.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [] }) + "\n",
  );

  const npmDir = globalTestRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);
  await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({ name: "powerups", private: true, dependencies: {} });

  const { projectDir } = await createSimpleProjectForTest({
    projectName: "test-project",
    testRoot,
  });

  await assert(uninstall.run({
    subcommands: ["npm:not-a-real-package"],
    flags: [],
    context: { root: projectDir, homeDir: globalTestRoot.path },
  })).throwsAsync(UninstallErrorCode.not_installed);

  await cleanup();
});