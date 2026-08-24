import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import fetchGitPackage from "#utils/install/fetch-package/fetch-git-package";
import { InstallErrorCode } from "#errors/installErrors";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

async function createSourceRepo(): Promise<string> {
  const sourceRepo = testRoot.append("/source-repo");
  await fs.create(sourceRepo);
  await io.run("git init", { cwd: sourceRepo.path });
  await fs.write(sourceRepo.append("/README.md"), "hello world\n");
  await io.run("git add .", { cwd: sourceRepo.path });
  await io.run('git commit -m "initial commit"', { cwd: sourceRepo.path });
  return sourceRepo.path;
}

test.case("should clone a git repository into the store path when the directory does not exist", async assert => {
  await setupTestDir();
  const sourceRepoPath = await createSourceRepo();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);

  const parsedSource: ParsedSource = {
    type: "git",
    configEntry: `git:${sourceRepoPath}`,
    storePath: `${INSTALLED_FOLDER.git}/localhost/source-repo`,
    cloneUrl: `file://${sourceRepoPath}`,
  };

  await assert(fetchGitPackage({ powerupDir, parsedSource })).noErrorAsync();

  const targetDir = powerupDir.append(`/${INSTALLED_FOLDER.git}/localhost/source-repo`);
  assert(await fs.exists(targetDir.append("/README.md"))).true();

  await cleanup();
});

test.case("should run git pull when the target directory already exists", async assert => {
  await setupTestDir();
  const sourceRepoPath = await createSourceRepo();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);

  const parsedSource: ParsedSource = {
    type: "git",
    configEntry: `git:${sourceRepoPath}`,
    storePath: `${INSTALLED_FOLDER.git}/localhost/source-repo`,
    cloneUrl: `file://${sourceRepoPath}`,
  };

  await fetchGitPackage({ powerupDir, parsedSource });

  await fs.write(sourceRepoPath + "/NEW-FILE.md", "new content\n");
  await io.run("git add .", { cwd: sourceRepoPath });
  await io.run('git commit -m "add new file"', { cwd: sourceRepoPath });

  await assert(fetchGitPackage({ powerupDir, parsedSource })).noErrorAsync();

  const targetDir = powerupDir.append(`/${INSTALLED_FOLDER.git}/localhost/source-repo`);
  assert(await fs.exists(targetDir.append("/NEW-FILE.md"))).true();

  await cleanup();
});

test.case("should throw fetch_failed when the git clone fails", async assert => {
  await setupTestDir();

  const powerupDir = testRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(powerupDir);

  const parsedSource: ParsedSource = {
    type: "git",
    configEntry: "git:nonexistent.host/owner/repo",
    storePath: `${INSTALLED_FOLDER.git}/nonexistent.host/owner/repo`,
    cloneUrl: "https://nonexistent.host/owner/repo",
  };

  await assert(fetchGitPackage({ powerupDir, parsedSource })).throwsAsync(InstallErrorCode.fetch_failed);

  await cleanup();
});