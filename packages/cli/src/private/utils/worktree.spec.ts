import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import {
  verifyGitRepo,
  createWorktree,
  removeWorktree,
  copyChangedFiles,
  type ChangedFile,
} from "#utils/worktree";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const execAsync = promisify(exec);

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");

async function gitInit(dir: FileRef): Promise<void> {
  await execAsync("git init", { cwd: dir.path });
  await execAsync("git config user.email test@test.com", { cwd: dir.path });
  await execAsync("git config user.name test", { cwd: dir.path });
  // Need at least one commit for worktree to work
  await dir.append("/README.md").write("init");
  await execAsync("git add -A", { cwd: dir.path });
  await execAsync("git commit -m init", { cwd: dir.path });
}

test.case("should pass when in a git repo (verifyGitRepo)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  let threw = false;
  try {
    await verifyGitRepo(testRoot);
  } catch {
    threw = true;
  }
  assert(threw).false();
  await testRoot.remove();
});

test.case("should throw when not in a git repo (verifyGitRepo)", async assert => {
  // Use a temp dir outside the project's git repo
  const noGitDir = fs.ref(path.join(tmpdir(), `saved-test-nogit-${randomBytes(4).toString("hex")}`));
  await fs.create(noGitDir);

  let threw = false;
  try {
    await verifyGitRepo(noGitDir);
  } catch {
    threw = true;
  }
  assert(threw).true();
  await noGitDir.remove();
});

test.case("should create a worktree in a temp dir", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  const wt = await createWorktree(testRoot);
  assert(await fs.exists(fs.ref(wt.path))).true();

  await removeWorktree(testRoot, wt.path);
  await testRoot.remove();
});

test.case("should remove the worktree", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  const wt = await createWorktree(testRoot);
  assert(await fs.exists(fs.ref(wt.path))).true();

  await removeWorktree(testRoot, wt.path);
  assert(await fs.exists(fs.ref(wt.path))).false();
  await testRoot.remove();
});

test.case("should copy files from worktree to project root", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  const wt = await createWorktree(testRoot);

  // Write a file in the worktree
  const worktreeFilePath = path.join(wt.path, "src/new-file.ts");
  await fs.create(fs.ref(path.dirname(worktreeFilePath)));
  await fs.ref(worktreeFilePath).write("export const x = 1;");

  const changedFiles: ChangedFile[] = [
    { worktreePath: worktreeFilePath, projectPath: "src/new-file.ts" },
  ];

  await copyChangedFiles(testRoot, changedFiles);

  const projectFile = testRoot.append("/src/new-file.ts");
  assert(await fs.exists(projectFile)).true();
  assert((await projectFile.text()).trim()).equals("export const x = 1;");

  await removeWorktree(testRoot, wt.path);
  await testRoot.remove();
});

test.case("should create worktree, write file, copy back, verify, and remove (integration)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  const wt = await createWorktree(testRoot);

  // Write a file in the worktree
  const worktreeFilePath = path.join(wt.path, "lib/hello.ts");
  await fs.create(fs.ref(path.dirname(worktreeFilePath)));
  await fs.ref(worktreeFilePath).write("export const hello = 'world';\n");

  // Copy back
  await copyChangedFiles(testRoot, [
    { worktreePath: worktreeFilePath, projectPath: "lib/hello.ts" },
  ]);

  // Verify in project root
  const projectFile = testRoot.append("/lib/hello.ts");
  assert(await fs.exists(projectFile)).true();
  assert((await projectFile.text()).trim()).equals("export const hello = 'world';");

  // Cleanup
  await removeWorktree(testRoot, wt.path);
  assert(await fs.exists(fs.ref(wt.path))).false();
  await testRoot.remove();
});