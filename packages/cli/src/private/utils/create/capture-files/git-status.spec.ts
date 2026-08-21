import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { getGitStatus } from "#utils/create/capture-files/git-status";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function gitInit(dir: import("@rcompat/fs").FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
  await dir.append("/README.md").write("init\n");
  await io.run("git add -A", { cwd: dir.path });
  await io.run("git commit -m init", { cwd: dir.path });
}

async function createFile(dir: import("@rcompat/fs").FileRef, filePath: string, content: string): Promise<void> {
  const target = dir.append(`/${filePath}`);
  await fs.create(target.directory);
  await target.write(content);
}

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should classify an untracked file as new", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/new-file.ts", "export const x = 1;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const newFile = changes.find(c => c.path === "src/new-file.ts");
  assert(newFile).defined();
  assert(newFile!.status).equals("new");

  await cleanup();
});

test.case("should classify a modified tracked file as modified", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await testRoot.append("/src/tracked.ts").write("export const x = 2;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const modified = changes.find(c => c.path === "src/tracked.ts");
  assert(modified).defined();
  assert(modified!.status).equals("modified");

  await cleanup();
});

test.case("should classify a deleted tracked file as deleted", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await testRoot.append("/src/tracked.ts").remove();

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const deleted = changes.find(c => c.path === "src/tracked.ts");
  assert(deleted).defined();
  assert(deleted!.status).equals("deleted");

  await cleanup();
});

test.case("should classify a renamed file as renamed", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/old.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m old", { cwd: testRoot.path });

  await io.run("git mv src/old.ts src/new.ts", { cwd: testRoot.path });

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const renamed = changes.find(c => c.path === "src/new.ts");
  assert(renamed).defined();
  assert(renamed!.status).equals("renamed");

  await cleanup();
});

test.case("should exclude files inside the .powerups/ directory", async assert => {
  await setupTestDir();

  await createFile(testRoot, ".powerups/_internal/test-pkg/dummy.json", "{}\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const powerupsChange = changes.find(c => c.path.startsWith(".powerups/"));
  assert(powerupsChange).undefined();

  await cleanup();
});

test.case("should exclude lock files (package-lock.json, pnpm-lock.yaml, etc.)", async assert => {
  await setupTestDir();

  await createFile(testRoot, "pnpm-lock.yaml", "lockfile: 1.0\n");
  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  const lockChange = changes.find(c => c.path === "pnpm-lock.yaml");
  assert(lockChange).undefined();
  const srcChange = changes.find(c => c.path === "src/new.ts");
  assert(srcChange).defined();

  await cleanup();
});

test.case("should return an empty array when there are no git changes", async assert => {
  await setupTestDir();

  const changes = await getGitStatus({ workingDir: testRoot, projectRoot: testRoot });
  assert(changes.length).equals(0);

  await cleanup();
});

test.case("should throw an error when the working directory is not a git repository", async assert => {
  const noGitDir = fs.ref(path.join(tmpdir(), `powerups-test-nogit-${randomBytes(4).toString("hex")}`));
  await fs.create(noGitDir);

  try {
    await getGitStatus({ workingDir: noGitDir, projectRoot: noGitDir });
    assert(true).equals(false);
  } catch (error) {
    assert(error instanceof Error).true();
  }

  await noGitDir.remove();
});

test.case("should scope git status to the specified working directory subpath", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");
  await createFile(testRoot, "lib/other.ts", "export const y = 2;\n");

  const changes = await getGitStatus({
    workingDir: testRoot.append("/src"),
    projectRoot: testRoot,
  });
  const srcChange = changes.find(c => c.path === "src/new.ts");
  assert(srcChange).defined();
  const libChange = changes.find(c => c.path === "lib/other.ts");
  assert(libChange).undefined();

  await cleanup();
});