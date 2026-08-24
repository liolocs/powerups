import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import removeInstallDirectory from "#utils/uninstall/remove-install-directory";
import type { ParsedSource } from "#utils/install/parse-source/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/remove-install-directory-test");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should remove a git install directory", async assert => {
  await setupTestDir();

  const gitDir = testRoot.append("/installed/git/github.com/owner/my-powerup");
  await fs.create(gitDir);
  await fs.write(gitDir.append("/file.txt"), "content");

  const parsedSource: ParsedSource = {
    type: "git",
    configEntry: "git:github.com/owner/my-powerup",
    storePath: "installed/git/github.com/owner/my-powerup",
    cloneUrl: "https://github.com/owner/my-powerup",
  };

  await removeInstallDirectory({ powerupDir: testRoot, parsedSource });

  assert(await fs.exists(gitDir)).false();

  await cleanup();
});

test.case("should not throw when the git install directory does not exist", async assert => {
  await setupTestDir();

  const parsedSource: ParsedSource = {
    type: "git",
    configEntry: "git:github.com/owner/my-powerup",
    storePath: "installed/git/github.com/owner/my-powerup",
    cloneUrl: "https://github.com/owner/my-powerup",
  };

  await removeInstallDirectory({ powerupDir: testRoot, parsedSource });

  await cleanup();
});

test.case("should not throw when the npm store directory does not exist", async assert => {
  await setupTestDir();

  const parsedSource: ParsedSource = {
    type: "npm",
    configEntry: "npm:@liolocs/powerup-hello-world",
    storePath: "installed/npm/node_modules/@liolocs/powerup-hello-world",
  };

  await removeInstallDirectory({ powerupDir: testRoot, parsedSource });

  await cleanup();
});