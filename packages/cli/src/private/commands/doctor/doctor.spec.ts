import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import doctor from "#commands/doctor/index";
import create from "#commands/create/index";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { DoctorErrorCode } from "#errors/doctorErrors";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  MAIN_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
} from "#constants";

const execAsync = promisify(exec);

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const activeFolder: FileRef = mainFolder.append(`/${ACTIVE_FOLDER}`);
const multiUseFolder: FileRef = activeFolder.append(`/${MULTI_USE_FOLDER}`);
const singleUseFolder: FileRef = activeFolder.append(`/${SINGLE_USE_FOLDER}`);

async function gitInit(dir: FileRef): Promise<void> {
  await execAsync("git init", { cwd: dir.path });
  await execAsync("git config user.email test@test.com", { cwd: dir.path });
  await execAsync("git config user.name test", { cwd: dir.path });
  await dir.append("/README.md").write("init");
  await execAsync("git add -A", { cwd: dir.path });
  await execAsync("git commit -m init", { cwd: dir.path });
}

async function gitCommit(dir: FileRef, message: string): Promise<void> {
  await execAsync("git add -A", { cwd: dir.path });
  try {
    await execAsync(`git commit -m "${message}"`, { cwd: dir.path });
  } catch {
    // Nothing to commit — that's fine
  }
}

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(activeFolder);
  await fs.create(multiUseFolder);
  await gitInit(testRoot);
}

test.case("doctor reports clean state with no powers", async assert => {
  await reset();
  // Create single-use folder too so there are no warnings
  await fs.create(singleUseFolder);
  await gitCommit(testRoot, "add folders");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("All checks passed.");
  assert(output).includes("0 multi-use power(s)");
  assert(output).includes("0 single-use power(s)");

  await testRoot.remove();
});

test.case("doctor validates powers with no issues", async assert => {
  await reset();
  await fs.create(singleUseFolder);

  await create.run({
    subcommands: [],
    flags: [{ flag: "--type", value: "multi-use" },
      { flag: "--name", value: "valid-power" },
      { flag: "--description", value: "test description" },],
    context: { root: testRoot },
  });
  // Commit so working tree is clean
  await gitCommit(testRoot, "add power");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("All checks passed.");
  assert(output).includes("1 multi-use power(s)");

  await testRoot.remove();
});

test.case("doctor reports orphaned file in a power folder", async assert => {
  await reset();
  await fs.create(singleUseFolder);

  await create.run({
    subcommands: [],
    flags: [{ flag: "--type", value: "multi-use" },
      { flag: "--name", value: "with-orphan" },
      { flag: "--description", value: "test description" },],
    context: { root: testRoot },
  });

  // Add an orphaned file
  await multiUseFolder.append("/with-orphan/extra.txt").write("orphan");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("Orphaned file: extra.txt");

  await testRoot.remove();
});

test.case("doctor reports invalid .json modify template", async assert => {
  await reset();
  await fs.create(singleUseFolder);

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "bad-modify" },
      { flag: "--description", value: "test description" },
      { flag: "--output", value: JSON.stringify({
        create: [],
        modify: [{ name: "wire", template: "wire.json", outputPath: "src/index.ts" }],
      }) },
    ],
    context: { root: testRoot },
  });

  // Write invalid JSON modify template
  await multiUseFolder.append("/bad-modify/wire.json").write("{not valid json}");

  const { output } = await captureStdoutOrError(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("Invalid modify template: wire.json");

  await testRoot.remove();
});

test.case("doctor warns when git working tree is dirty", async assert => {
  await reset();
  await fs.create(singleUseFolder);
  await gitCommit(testRoot, "clean state");

  // Make a dirty change
  await testRoot.append("/README.md").write("dirty change");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("Working tree is not clean");
  assert(output).includes("WARN");

  await testRoot.remove();
});

test.case("doctor errors when not a git repo", async assert => {
  // Use a temp dir outside the project's git repo
  const noGitRoot = fs.ref(path.join(tmpdir(), `powers-test-nogit-${randomBytes(4).toString("hex")}`));
  await fs.create(noGitRoot);
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}`));
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}/${ACTIVE_FOLDER}`));
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`));

  const { output } = await captureStdoutOrError(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: noGitRoot },
  }));

  assert(output).includes("Not a git repository");
  assert(output).includes("[ERROR] [git:repo]");

  await noGitRoot.remove();
});

test.case("doctor checks both types in one pass", async assert => {
  await reset();
  await fs.create(singleUseFolder);

  // Create a multi-use power
  await create.run({
    subcommands: [],
    flags: [{ flag: "--type", value: "multi-use" },
      { flag: "--name", value: "multi" },
      { flag: "--description", value: "test description" },],
    context: { root: testRoot },
  });

  // Create a single-use power
  await create.run({
    subcommands: [],
    flags: [{ flag: "--type", value: "single-use" },
      { flag: "--name", value: "single" },
      { flag: "--description", value: "test description" }],
    context: { root: testRoot },
  });

  // Commit so working tree is clean
  await gitCommit(testRoot, "add powers");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("1 multi-use power(s)");
  assert(output).includes("1 single-use power(s)");
  assert(output).includes("All checks passed.");

  await testRoot.remove();
});

test.group("doctor errors", () => {
  test.case(`should fail with not_initialized when ${MAIN_FOLDER}} folder not found`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await gitInit(testRoot);

    let threw;
    try {
      await doctor.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(DoctorErrorCode.not_initialized);

    await testRoot.remove();
  });

  test.case("should fail with validation_failed when a template file is missing", async assert => {
    await reset();
    await fs.create(singleUseFolder);

    await create.run({
      subcommands: [],
      flags: [
        { flag: "--type", value: "multi-use" },
        { flag: "--name", value: "bad-power" },
      { flag: "--description", value: "test description" },
        { flag: "--output", value: JSON.stringify({
          create: [{ name: "f", template: "missing.njk", outputPath: "out.ts" }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    // Remove the template file
    await multiUseFolder.append("/bad-power/missing.njk").remove();

    const { output, error } = await captureStdoutOrError(() => doctor.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("missing template file: missing.njk");
    assert(error instanceof CodeError).true();
    assert((error as CodeError).code).equals(DoctorErrorCode.validation_failed);

    await testRoot.remove();
  });
});