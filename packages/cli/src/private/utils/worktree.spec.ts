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
import io from "@rcompat/io";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");

async function gitInit(dir: FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
  // Need at least one commit for worktree to work
  await dir.append("/README.md").write("init");
  await io.run("git add -A", { cwd: dir.path });
  await io.run("git commit -m init", { cwd: dir.path });
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
  const noGitDir = fs.ref(path.join(tmpdir(), `powerups-test-nogit-${randomBytes(4).toString("hex")}`));
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

test.case("should delete a file from project root when deleted flag is set", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  // Create a file in the project root first
  const projectFile = testRoot.append("/src/legacy.ts");
  await fs.create(projectFile.directory);
  await projectFile.write("export const legacy = true;");

  const wt = await createWorktree(testRoot);

  // Simulate a delete: the file was removed from the worktree,
  // and we pass a ChangedFile with deleted: true
  const changedFiles: ChangedFile[] = [
    { worktreePath: path.join(wt.path, "src/legacy.ts"), projectPath: "src/legacy.ts", deleted: true },
  ];

  await copyChangedFiles(testRoot, changedFiles);

  assert(await fs.exists(projectFile)).false();

  await removeWorktree(testRoot, wt.path);
  await testRoot.remove();
});

test.case("should handle both create and delete in one copyChangedFiles call", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  // Create a file that will be deleted
  const toDelete = testRoot.append("/src/old.ts");
  await fs.create(toDelete.directory);
  await toDelete.write("old");

  const wt = await createWorktree(testRoot);

  // Write a new file in the worktree
  const newFilePath = path.join(wt.path, "src/new.ts");
  await fs.create(fs.ref(path.dirname(newFilePath)));
  await fs.ref(newFilePath).write("export const x = 1;");

  const changedFiles: ChangedFile[] = [
    { worktreePath: newFilePath, projectPath: "src/new.ts" },
    { worktreePath: path.join(wt.path, "src/old.ts"), projectPath: "src/old.ts", deleted: true },
  ];

  await copyChangedFiles(testRoot, changedFiles);

  assert(await fs.exists(testRoot.append("/src/new.ts"))).true();
  assert(await fs.exists(testRoot.append("/src/old.ts"))).false();

  await removeWorktree(testRoot, wt.path);
  await testRoot.remove();
});