import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { getGitStatus, type GitChange } from "#utils/git/git-status";
import { CodeError } from "@rcompat/error";
import { CreateErrorCode } from "#errors/createErrors";
import { MAIN_FOLDER, INTERNAL_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function gitInit(dir: FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
  await dir.append("/README.md").write("init\n");
  await io.run("git add -A", { cwd: dir.path });
  await io.run("git commit -m init", { cwd: dir.path });
}

async function createFile(dir: FileRef, filePath: string, content: string): Promise<void> {
  const target = dir.append(`/${filePath}`);
  await fs.create(target.directory);
  await target.write(content);
}

async function modifyFile(dir: FileRef, filePath: string, content: string): Promise<void> {
  await dir.append(`/${filePath}`).write(content);
}

async function deleteFile(dir: FileRef, filePath: string): Promise<void> {
  await dir.append(`/${filePath}`).remove();
}

async function gitAdd(dir: FileRef, filePath: string): Promise<void> {
  await io.run(`git add "${filePath}"`, { cwd: dir.path });
}

async function gitMv(dir: FileRef, oldPath: string, newPath: string): Promise<void> {
  await io.run(`git mv "${oldPath}" "${newPath}"`, { cwd: dir.path });
}

test.case("untracked file (??) is classified as new", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/new-file.ts", "export const x = 1;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const newFile = changes.find(c => c.path === "src/new-file.ts");
  assert(newFile).defined();
  assert(newFile!.status).equals("new");

  await testRoot.remove();
});

test.case("unstaged modification ( M) is classified as modified", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await modifyFile(testRoot, "src/tracked.ts", "export const x = 2;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const modified = changes.find(c => c.path === "src/tracked.ts");
  assert(modified).defined();
  assert(modified!.status).equals("modified");

  await testRoot.remove();
});

test.case("staged modification (M ) is classified as modified", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await modifyFile(testRoot, "src/tracked.ts", "export const x = 2;\n");
  await gitAdd(testRoot, "src/tracked.ts");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const modified = changes.find(c => c.path === "src/tracked.ts");
  assert(modified).defined();
  assert(modified!.status).equals("modified");

  await testRoot.remove();
});

test.case("staged + unstaged modification (MM) is classified as modified", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await modifyFile(testRoot, "src/tracked.ts", "export const x = 2;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await modifyFile(testRoot, "src/tracked.ts", "export const x = 3;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const modified = changes.find(c => c.path === "src/tracked.ts");
  assert(modified).defined();
  assert(modified!.status).equals("modified");

  await testRoot.remove();
});

test.case("unstaged deletion ( D) is classified as deleted", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await deleteFile(testRoot, "src/tracked.ts");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const deleted = changes.find(c => c.path === "src/tracked.ts");
  assert(deleted).defined();
  assert(deleted!.status).equals("deleted");

  await testRoot.remove();
});

test.case("staged deletion (D ) is classified as deleted", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/tracked.ts");
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await deleteFile(testRoot, "src/tracked.ts");
  await gitAdd(testRoot, "src/tracked.ts");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const deleted = changes.find(c => c.path === "src/tracked.ts");
  assert(deleted).defined();
  assert(deleted!.status).equals("deleted");

  await testRoot.remove();
});

test.case("renamed file (R ) is classified as renamed", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/old.ts", "export const x = 1;\n");
  await gitAdd(testRoot, "src/old.ts");
  await io.run("git commit -m old", { cwd: testRoot.path });

  await gitMv(testRoot, "src/old.ts", "src/new.ts");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const renamed = changes.find(c => c.path === "src/new.ts");
  assert(renamed).defined();
  assert(renamed!.status).equals("renamed");

  await testRoot.remove();
});

test.case(".powerups/ paths are excluded", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, ".powerups/internal/test-pkg/dummy.json", "{}\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const powerupsChange = changes.find(c => c.path.startsWith(".powerups/"));
  assert(powerupsChange).undefined();

  await testRoot.remove();
});

test.case("pnpm-lock.yaml is excluded", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "pnpm-lock.yaml", "lockfile: 1.0\n");
  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const lockfileChange = changes.find(c => c.path === "pnpm-lock.yaml");
  assert(lockfileChange).undefined();
  const newFile = changes.find(c => c.path === "src/new.ts");
  assert(newFile).defined();

  await testRoot.remove();
});

test.case("package-lock.json is excluded", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "package-lock.json", "{}\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const lockfileChange = changes.find(c => c.path === "package-lock.json");
  assert(lockfileChange).undefined();

  await testRoot.remove();
});

test.case("empty git status returns empty array", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  assert(changes.length).equals(0);

  await testRoot.remove();
});

test.case("not a git repo throws not_a_git_repo error", async assert => {
  const noGitDir = fs.ref(path.join(tmpdir(), `powerups-test-nogit-${randomBytes(4).toString("hex")}`));
  await fs.create(noGitDir);

  let threw = false;
  let errorCode: string | undefined;
  try {
    await getGitStatus({ workingDir: noGitDir, projectRoot: noGitDir });
  } catch (e: unknown) {
    assert((e as CodeError) instanceof CodeError).true();
    errorCode = (e as CodeError).code;
    threw = true;
  }
  assert(threw).true();
  assert(errorCode).equals(CreateErrorCode.not_a_git_repo);

  await noGitDir.remove();
});

test.case("working-dir scoped to subdirectory only shows changes within it", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");
  await createFile(testRoot, "lib/bar.ts", "export const bar = 2;\n");

  const subDir = testRoot.append("/src");
  const changes = await getGitStatus({ workingDir: subDir, projectRoot: testRoot });
  const fooChange = changes.find(c => c.path === "src/foo.ts");
  const barChange = changes.find(c => c.path === "lib/bar.ts");

  assert(fooChange).defined();
  assert(barChange).undefined();

  await testRoot.remove();
});