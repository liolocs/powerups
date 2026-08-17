import test from "#test-utils/test/index";
import checkForCleanGitState from "#utils/use/check-for-pre-use-errors/check-for-clean-git-state";
import runtime from "@rcompat/runtime";
import fs, { type FileRef } from "@rcompat/fs";
import git from "#utils/git";
import { UseErrorCode } from "#errors/useErrors";

const testRoot = fs.ref("/tmp-test-dir")

async function setupTestDir(): Promise<void> {
  if (await testRoot.exists()) {
    await testRoot.remove();
  }
  await fs.create(testRoot);
}

// async function cleanup(): Promise<void> {
//   await testRoot.remove();
// }

// test.case("should not fail if there is not git repo", async assert => {
//   await setupTestDir();

//   await assert(checkForCleanGitState(testRoot)).noErrorAsync();
//   await cleanup();
// });

// test.case("should fail if there is git repo and uncommited changes", async assert => {
//   await setupTestDir();
//   testRoot.append("some-file.txt").write("some content");
//   await git.init({ cwd: testRoot });

//   await assert(checkForCleanGitState(testRoot))
//     .throwsAsync(UseErrorCode.working_tree_dirty);

//   await cleanup();
// });