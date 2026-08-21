import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import captureWorkingDir from "#utils/create/capture-files/capture-working-dir";
import createStepsFromNewFiles from "#utils/create/capture-files/create-steps-from-new-files";
import createStepsFromModifiedFiles from "#utils/create/capture-files/create-steps-from-modified-files";
import createStepsFromDeletedFiles from "#utils/create/capture-files/create-steps-from-deleted-files";
import type { GitChange } from "#utils/create/capture-files/git-status";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function gitInit(dir: import("@rcompat/fs").FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
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
  await createFile(testRoot, "README.md", "# test\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m init", { cwd: testRoot.path });
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should generate create, modify, and delete steps for a mix of git changes", async assert => {
  await setupTestDir();

  await createFile(testRoot, "old-file.txt", "old content\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add-old", { cwd: testRoot.path });

  await createFile(testRoot, "src/new-file.ts", "export const x = 1;\n");
  await testRoot.append("/README.md").write("# modified\n");
  await testRoot.append("/old-file.txt").remove();

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureWorkingDir({
    projectRoot: testRoot,
    workingDir: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.some(s => s.type === "create" && s.outputPath === "src/new-file.ts")).true();
  assert(result.steps.some(s => s.type === "modify" && s.outputPath === "README.md")).true();
  assert(result.steps.some(s => s.type === "delete" && s.outputPath === "old-file.txt")).true();

  await cleanup();
});

test.case("should return empty steps with a warning when there are no git changes", async assert => {
  await setupTestDir();

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureWorkingDir({
    projectRoot: testRoot,
    workingDir: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.length).equals(0);
  assert(result.warnings.length).equals(1);

  await cleanup();
});

test.case("should add a warning for renamed or unknown status changes without generating a step", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/old.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  await io.run("git mv src/old.ts src/new.ts", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureWorkingDir({
    projectRoot: testRoot,
    workingDir: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  const renamedWarnings = result.warnings.filter(w => w.includes("Renamed"));
  assert(renamedWarnings.length > 0).true();

  await cleanup();
});

test.case("should not write any template files in dry-run mode", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/new-file.ts", "export const x = 1;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  await captureWorkingDir({
    projectRoot: testRoot,
    workingDir: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: true,
  });

  assert(await fs.exists(newPowerupDir.append("/templates"))).false();

  await cleanup();
});

test.case("should generate a create step with a template for each new file", async assert => {
  await setupTestDir();

  const newFiles: GitChange[] = [
    { path: "src/foo.ts", status: "new", rawStatus: "??" },
    { path: "src/bar.ts", status: "new", rawStatus: "??" },
  ];

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");
  await createFile(testRoot, "src/bar.ts", "export const bar = 2;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const steps = await createStepsFromNewFiles({
    newFiles,
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    isDryRun: false,
  });

  assert(steps.length).equals(2);
  assert(steps.every(s => s.type === "create")).true();

  await cleanup();
});

test.case("should write template files to the powerup directory when not in dry-run mode", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  await createStepsFromNewFiles({
    newFiles: [{ path: "src/foo.ts", status: "new", rawStatus: "??" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    isDryRun: false,
  });

  assert(await fs.exists(newPowerupDir.append("/templates/src/foo.ts.ts"))).true();

  await cleanup();
});

test.case("should not write template files in dry-run mode for new files", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  await createStepsFromNewFiles({
    newFiles: [{ path: "src/foo.ts", status: "new", rawStatus: "??" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    isDryRun: true,
  });

  assert(await fs.exists(newPowerupDir.append("/templates"))).false();

  await cleanup();
});

test.case("should generate a modify step with diff-based modifications for a modified file", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await testRoot.append("/src/tracked.ts").write("export const x = 2;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const steps = await createStepsFromModifiedFiles({
    modifiedFiles: [{ path: "src/tracked.ts", status: "modified", rawStatus: " M" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    warnings: [],
    isDryRun: false,
  });

  assert(steps.length).equals(1);
  assert(steps[0]!.type).equals("modify");

  await cleanup();
});

test.case("should add a warning for binary file diffs", async assert => {
  await setupTestDir();

  const binaryContent = Buffer.from([0x00, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("binary");
  await createFile(testRoot, "image.png", binaryContent);
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m binary", { cwd: testRoot.path });

  const modifiedBinary = Buffer.from([0x00, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x44, 0x49, 0x46, 0x46]).toString("binary");
  await createFile(testRoot, "image.png", modifiedBinary);

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const warnings: string[] = [];

  await createStepsFromModifiedFiles({
    modifiedFiles: [{ path: "image.png", status: "modified", rawStatus: " M" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    warnings,
    isDryRun: false,
  });

  assert(warnings.length > 0).true();

  await cleanup();
});

test.case("should return no steps and add a warning for empty diffs", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const warnings: string[] = [];

  const steps = await createStepsFromModifiedFiles({
    modifiedFiles: [{ path: "src/tracked.ts", status: "modified", rawStatus: " M" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    warnings,
    isDryRun: false,
  });

  assert(steps.length).equals(0);
  assert(warnings.length > 0).true();

  await cleanup();
});

test.case("should not write template files in dry-run mode for modified files", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m tracked", { cwd: testRoot.path });

  await testRoot.append("/src/tracked.ts").write("export const x = 2;\n");

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  await createStepsFromModifiedFiles({
    modifiedFiles: [{ path: "src/tracked.ts", status: "modified", rawStatus: " M" }],
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    existingNames: new Set(),
    warnings: [],
    isDryRun: true,
  });

  assert(await fs.exists(newPowerupDir.append("/templates"))).false();

  await cleanup();
});

test.case("should generate a delete step for each deleted file without a template", async assert => {
  const steps = createStepsFromDeletedFiles({
    deletedFiles: [
      { path: "src/old.ts", status: "deleted", rawStatus: " D" },
      { path: "src/another.ts", status: "deleted", rawStatus: " D" },
    ],
    existingNames: new Set(),
  });

  assert(steps.length).equals(2);
  assert(steps.every(s => s.type === "delete")).true();
  assert(steps.every(s => !("template" in s && s.template !== undefined))).true();
});

test.case("should generate unique step names when multiple files share similar paths", async assert => {
  const existingNames = new Set<string>();

  const steps = createStepsFromDeletedFiles({
    deletedFiles: [
      { path: "src/foo.ts", status: "deleted", rawStatus: " D" },
      { path: "lib/foo.ts", status: "deleted", rawStatus: " D" },
    ],
    existingNames,
  });

  const names = steps.map(s => s.name);
  assert(names[0] === names[1]).false();
});