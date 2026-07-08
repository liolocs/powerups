import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import doctor from "#commands/doctor";
import createCreateCommand from "#commands/output/create";
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
  OUTPUT_FOLDER,
  TEMPLATE_FOLDER,
  FEATURE_FOLDER,
} from "#constants";

const execAsync = promisify(exec);

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const outputFolder: FileRef = mainFolder.append(`/${OUTPUT_FOLDER}`);
const templateFolder: FileRef = outputFolder.append(`/${TEMPLATE_FOLDER}`);
const featureFolder: FileRef = outputFolder.append(`/${FEATURE_FOLDER}`);

const createCmd = createCreateCommand("template");

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
  await fs.create(outputFolder);
  await fs.create(templateFolder);
  await gitInit(testRoot);
}

test.case("doctor reports clean state with no templates or features", async assert => {
  await reset();
  // Create feature folder too so there are no warnings
  await fs.create(featureFolder);
  await gitCommit(testRoot, "add folders");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("All checks passed.");
  assert(output).includes("0 template(s)");
  assert(output).includes("0 feature(s)");

  await testRoot.remove();
});

test.case("doctor validates templates and features with no issues", async assert => {
  await reset();
  await fs.create(featureFolder);

  await createCmd.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "valid-template" }],
    context: { root: testRoot },
  });
  // Commit so working tree is clean
  await gitCommit(testRoot, "add template");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("All checks passed.");
  assert(output).includes("1 template(s)");

  await testRoot.remove();
});

test.case("doctor reports orphaned file in a template folder", async assert => {
  await reset();
  await fs.create(featureFolder);

  await createCmd.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "with-orphan" }],
    context: { root: testRoot },
  });

  // Add an orphaned file
  await templateFolder.append("/with-orphan/extra.txt").write("orphan");

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
  await fs.create(featureFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "bad-modify" },
      { flag: "--output", value: JSON.stringify({
        create: [],
        modify: [{ name: "wire", template: "wire.json", outputPath: "src/index.ts" }],
      }) },
    ],
    context: { root: testRoot },
  });

  // Write invalid JSON modify template
  await templateFolder.append("/bad-modify/wire.json").write("{not valid json}");

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
  await fs.create(featureFolder);
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
  const noGitRoot = fs.ref(path.join(tmpdir(), `saved-test-nogit-${randomBytes(4).toString("hex")}`));
  await fs.create(noGitRoot);
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}`));
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}/${OUTPUT_FOLDER}`));
  await fs.create(noGitRoot.append(`/${MAIN_FOLDER}/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`));

  const { output } = await captureStdoutOrError(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: noGitRoot },
  }));

  assert(output).includes("Not a git repository");
  assert(output).includes("[ERROR] [git:repo]");

  await noGitRoot.remove();
});

test.case("doctor checks both domains in one pass", async assert => {
  await reset();
  await fs.create(featureFolder);

  // Create a template
  await createCmd.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "tmpl" }],
    context: { root: testRoot },
  });

  // Create a feature
  const createFeature = createCreateCommand("feature");
  await createFeature.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "feat" }],
    context: { root: testRoot },
  });

  // Commit so working tree is clean
  await gitCommit(testRoot, "add template and feature");

  const output = await captureStdout(() => doctor.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("1 template(s)");
  assert(output).includes("1 feature(s)");
  assert(output).includes("All checks passed.");

  await testRoot.remove();
});

test.group("doctor errors", () => {
  test.case("should fail with not_initialized when .saved folder not found", async assert => {
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
    await fs.create(featureFolder);

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "bad-template" },
        { flag: "--output", value: JSON.stringify({
          create: [{ name: "f", template: "missing.njk", outputPath: "out.ts" }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    // Remove the template file
    await templateFolder.append("/bad-template/missing.njk").remove();

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