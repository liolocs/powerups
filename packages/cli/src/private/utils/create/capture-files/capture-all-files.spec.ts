import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import { tmpdir } from "node:os";
import path from "node:path";
import captureAllFiles from "#utils/create/capture-files/capture-all-files";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function gitInit(dir: import("@rcompat/fs").FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
}

async function createFile(
  dir: import("@rcompat/fs").FileRef,
  filePath: string,
  content: string,
): Promise<void> {
  const target = dir.append(`/${filePath}`);
  await fs.create(target.directory);
  await target.write(content);
}

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);
  await createFile(testRoot, "README.md", "# test\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m init", { cwd: testRoot.path });
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("captures tracked files as verbatim copies with file-field steps", async assert => {
  await setupTestDir();

  const fooContent = "export const foo = 1;\n";
  const barContent = "export const bar = 2;\n";
  await createFile(testRoot, "src/foo.ts", fooContent);
  await createFile(testRoot, "src/bar.ts", barContent);
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.length).equals(3);
  assert(result.steps.every(s => s.type === "create" && typeof s.file === "string")).true();
  assert(
    result.steps.some(
      s => s.type === "create" && s.outputPath === "README.md" && s.file === "src/create/README.md",
    ),
  ).true();
  assert(
    result.steps.some(
      s => s.type === "create" && s.outputPath === "src/foo.ts" && s.file === "src/create/src/foo.ts",
    ),
  ).true();
  assert(
    result.steps.some(
      s => s.type === "create" && s.outputPath === "src/bar.ts" && s.file === "src/create/src/bar.ts",
    ),
  ).true();

  const copiedFoo = await newPowerupDir.append("/src/create/src/foo.ts").text();
  assert(copiedFoo).equals(fooContent);
  const copiedBar = await newPowerupDir.append("/src/create/src/bar.ts").text();
  assert(copiedBar).equals(barContent);

  await cleanup();
});

test.case("works without git — falls back to filesystem walk", async assert => {
  const nonGitRoot = fs.ref(path.join(tmpdir(), `capture-nogit-${Date.now()}`));
  await nonGitRoot.remove({ recursive: true }).catch(() => {});
  await fs.create(nonGitRoot);
  await createFile(nonGitRoot, "hello.txt", "no git here\n");
  await createFile(nonGitRoot, "src/main.ts", "export const main = 1;\n");
  await createFile(nonGitRoot, "node_modules/dep/index.js", "skipped\n");

  const newPowerupDir = nonGitRoot.append("/.powerups/installed/_internal/ng");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: nonGitRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.length).equals(2);
  assert(result.steps.some(s => s.outputPath === "hello.txt")).true();
  assert(result.steps.some(s => s.outputPath === "src/main.ts")).true();
  assert(result.steps.some(s => s.outputPath.includes("node_modules/"))).false();
  assert(await newPowerupDir.append("/src/create/hello.txt").text()).equals("no git here\n");

  await nonGitRoot.remove({ recursive: true });
});

test.case("excludes the new powerup's own directory", async assert => {
  await setupTestDir();

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);
  await fs.create(newPowerupDir.append("/src/create"));
  await newPowerupDir.append("/index.ts").write("export default {};\n");
  await newPowerupDir.append("/src/create/placeholder.ts").write("// placeholder\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(
    result.steps.some(s =>
      s.outputPath.startsWith(".powerups/installed/_internal/my-powerup/"),
    ),
  ).false();

  await cleanup();
});

test.case("respects .gitignore — gitignored files are not captured", async assert => {
  await setupTestDir();

  await createFile(testRoot, ".gitignore", "secret.txt\n");
  await createFile(testRoot, "secret.txt", "secret\n");
  await createFile(testRoot, "visible.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.some(s => s.outputPath === "secret.txt")).false();
  assert(
    result.steps.some(s => s.outputPath === "visible.ts" && s.file === "src/create/visible.ts"),
  ).true();

  await cleanup();
});

test.case("excludes lock files from capture", async assert => {
  await setupTestDir();

  await createFile(testRoot, "pnpm-lock.yaml", "lockfile: 1.0\n");
  await createFile(testRoot, "src/main.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.some(s => s.outputPath === "pnpm-lock.yaml")).false();

  await cleanup();
});

test.case("excludes .env files from capture", async assert => {
  await setupTestDir();

  await createFile(testRoot, ".env", "SECRET=abc\n");
  await createFile(testRoot, "src/main.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.some(s => s.outputPath === ".env")).false();

  await cleanup();
});

test.case("does not write any source files in dry-run mode", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: true,
  });

  assert(result.steps.length).equals(2);
  assert(result.steps.every(s => typeof s.file === "string")).true();
  assert(await fs.exists(newPowerupDir.append("/src/create"))).false();

  await cleanup();
});