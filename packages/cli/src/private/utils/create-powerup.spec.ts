import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import { createPowerup } from "#utils/create-powerup";
import { instructionsSchema } from "#schemas/instruction";
import { CodeError } from "@rcompat/error";
import { CreateErrorCode } from "#errors/createErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  CONFIG_FILE,
} from "#constants";

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

async function setupTestEnv(): Promise<{ envRoot: FileRef; projectRoot: FileRef }> {
  await testRoot.remove();
  await fs.create(testRoot);

  await testRoot.append("/package.json").write(JSON.stringify({
    name: "test-project",
    version: "1.0.0",
  }) + "\n");

  await gitInit(testRoot);

  await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
  await fs.create(testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}`));
  await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).writeJSON({ packages: [] });

  return { envRoot: testRoot, projectRoot: testRoot };
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

async function gitCommit(dir: FileRef, message: string): Promise<void> {
  await io.run("git add -A", { cwd: dir.path });
  await io.run(`git commit -m "${message}"`, { cwd: dir.path });
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

function readInstructions(dir: FileRef, packageName: string, type: string, name: string): Promise<any> {
  return dir.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}/${type}/${name}/instructions.json`).json() as Promise<any>;
}

test.case("blank mode creates instructions.json with empty steps", async assert => {
  await setupTestEnv();

  const result = await createPowerup({
    name: "my-powerup",
    projectRoot: testRoot,
  });

  assert(result.newFileCount).equals(0);
  assert(result.modifiedFileCount).equals(0);
  assert(result.deletedFileCount).equals(0);

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "my-powerup");
  assert(instructions.steps.length).equals(0);

  await cleanup();
});

test.case("new file generates create step with verbatim template", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/new-component.ts", "export const foo = 1;\n");

  const result = await createPowerup({
    name: "capture-new",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.newFileCount).equals(1);
  assert(result.modifiedFileCount).equals(0);

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "capture-new");
  assert(instructions.steps.length).equals(1);
  assert(instructions.steps[0].type).equals("create");
  assert(instructions.steps[0].outputPath).equals("src/new-component.ts");
  assert(instructions.steps[0].template).equals("src/src/new-component.ts");

  const templateContent = await testRoot
    .append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/test-project/${SINGLE_USE_FOLDER}/capture-new/src/src/new-component.ts`)
    .text();
  assert(templateContent).equals("export const foo = 1;\n");

  await cleanup();
});

test.case("modified file generates modify step with modification template", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitCommit(testRoot, "add tracked");
  await modifyFile(testRoot, "src/tracked.ts", "export const x = 2;\n");

  const result = await createPowerup({
    name: "capture-mod",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.modifiedFileCount).equals(1);

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "capture-mod");
  assert(instructions.steps.length).equals(1);
  assert(instructions.steps[0].type).equals("modify");
  assert(instructions.steps[0].outputPath).equals("src/tracked.ts");

  const modifyTemplatePath = testRoot
    .append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/test-project/${SINGLE_USE_FOLDER}/capture-mod/src/src/tracked.ts.modify.json`);
  assert(await fs.exists(modifyTemplatePath)).true();

  await cleanup();
});

test.case("deleted file generates delete step with no template", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/old.ts", "export const old = true;\n");
  await gitCommit(testRoot, "add old");
  await deleteFile(testRoot, "src/old.ts");

  const result = await createPowerup({
    name: "capture-del",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.deletedFileCount).equals(1);

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "capture-del");
  assert(instructions.steps.length).equals(1);
  assert(instructions.steps[0].type).equals("delete");
  assert(instructions.steps[0].outputPath).equals("src/old.ts");

  await cleanup();
});

test.case("mixed changes produce all three step types in correct order", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/tracked.ts", "export const x = 1;\n");
  await gitCommit(testRoot, "add tracked");

  await createFile(testRoot, "src/new.ts", "export const y = 2;\n");
  await modifyFile(testRoot, "src/tracked.ts", "export const x = 2;\n");
  await deleteFile(testRoot, "README.md");

  const result = await createPowerup({
    name: "capture-mixed",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.newFileCount).equals(1);
  assert(result.modifiedFileCount).equals(1);
  assert(result.deletedFileCount).equals(1);

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "capture-mixed");
  assert(instructions.steps.length).equals(3);
  assert(instructions.steps[0].type).equals("create");
  assert(instructions.steps[1].type).equals("modify");
  assert(instructions.steps[2].type).equals("delete");

  await cleanup();
});

test.case("renamed file produces warning and no step", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/old-name.ts", "export const x = 1;\n");
  await gitCommit(testRoot, "add old-name");
  await io.run(`git mv "src/old-name.ts" "src/new-name.ts"`, { cwd: testRoot.path });

  const result = await createPowerup({
    name: "capture-rename",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.warnings.length > 0);
  assert(result.warnings.some(w => w.includes("src/new-name.ts"))).true();

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "capture-rename");
  const renameSteps = instructions.steps.filter((s: { outputPath: string }) =>
    s.outputPath.includes("old-name") || s.outputPath.includes("new-name"));
  assert(renameSteps.length).equals(0);

  await cleanup();
});

test.case("package auto-creation from package.json name", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  const result = await createPowerup({
    name: "auto-pkg-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.packageName).equals("test-project");
  assert(result.packageAutoCreated).true();

  const packageJsonPath = testRoot
    .append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/test-project/${PACKAGE_FILE}`);
  assert(await fs.exists(packageJsonPath)).true();

  await cleanup();
});

test.case("scoped package name is unscoped", async assert => {
  await setupTestEnv();
  await testRoot.append("/package.json").write(JSON.stringify({
    name: "@my-scope/my-project",
    version: "1.0.0",
  }) + "\n");
  await gitCommit(testRoot, "update package name");

  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  const result = await createPowerup({
    name: "scoped-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.packageName).equals("my-project");

  await cleanup();
});

test.case("step names are unique for files with same basename in different dirs", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/a/index.ts", "export const a = 1;\n");
  await createFile(testRoot, "src/b/index.ts", "export const b = 2;\n");

  const result = await createPowerup({
    name: "collision-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "collision-test");
  const names = instructions.steps.map((s: { name: string }) => s.name);
  const uniqueNames = new Set(names);
  assert(names.length).equals(uniqueNames.size);

  await cleanup();
});

test.case("instructions.json validates against schema", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");
  await createFile(testRoot, "src/tracked.ts", "export const y = 2;\n");
  await gitCommit(testRoot, "add tracked");
  await modifyFile(testRoot, "src/tracked.ts", "export const y = 3;\n");

  await createPowerup({
    name: "validate-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "validate-test");
  instructionsSchema.parse(instructions);

  await cleanup();
});

test.case("powerup is registered in package.json", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  await createPowerup({
    name: "register-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  const pkgJson = await testRoot
    .append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/test-project/${PACKAGE_FILE}`)
    .json() as Record<string, unknown>;
  const powerups = (pkgJson.powerups as Record<string, Record<string, Record<string, string>>>).active;
  assert(powerups[SINGLE_USE_FOLDER]["register-test"]).defined();

  await cleanup();
});

test.case("no git changes produces blank instructions with warning", async assert => {
  await setupTestEnv();

  const result = await createPowerup({
    name: "no-changes",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.warnings.length > 0);
  assert(result.warnings.some(w => w.includes("No git changes"))).true();

  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "no-changes");
  assert(instructions.steps.length).equals(0);

  await cleanup();
});

test.case("lockfile changes are excluded", async assert => {
  await setupTestEnv();

  await createFile(testRoot, "pnpm-lock.yaml", "lockfile: 1.0\n");
  await createFile(testRoot, "src/new.ts", "export const x = 1;\n");

  const result = await createPowerup({
    name: "lockfile-test",
    workingDir: testRoot.path,
    projectRoot: testRoot,
  });

  assert(result.newFileCount).equals(1);
  const instructions = await readInstructions(testRoot, "test-project", SINGLE_USE_FOLDER, "lockfile-test");
  const lockfileSteps = instructions.steps.filter((s: { outputPath: string }) =>
    s.outputPath === "pnpm-lock.yaml");
  assert(lockfileSteps.length).equals(0);

  await cleanup();
});

test.case("main folder not found throws error", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await gitInit(testRoot);

  let threw = false;
  let errorCode: string | undefined;
  try {
    await createPowerup({
      name: "should-fail",
      projectRoot: testRoot,
    });
  } catch (e: unknown) {
    assert((e as CodeError) instanceof CodeError).true();
    errorCode = (e as CodeError).code;
    threw = true;
  }
  assert(threw).true();
  assert(errorCode).equals(CreateErrorCode.main_folder_not_found);

  await cleanup();
});

test.case("already exists throws error", async assert => {
  await setupTestEnv();

  await createPowerup({
    name: "dup-test",
    projectRoot: testRoot,
  });

  let threw = false;
  let errorCode: string | undefined;
  try {
    await createPowerup({
      name: "dup-test",
      projectRoot: testRoot,
    });
  } catch (e: unknown) {
    assert((e as CodeError) instanceof CodeError).true();
    errorCode = (e as CodeError).code;
    threw = true;
  }
  assert(threw).true();
  assert(errorCode).equals(CreateErrorCode.already_exists);

  await cleanup();
});

test.case("optional flags are applied to instructions.json", async assert => {
  await setupTestEnv();

  await createPowerup({
    name: "flags-test",
    projectRoot: testRoot,
    pack: "custom-pkg",
    type: "multi-use",
    description: "A test powerup",
    intent: "test,example",
    variables: "name,value",
    optionalVariables: "optional1,optional2",
  });

  const instructions = await readInstructions(testRoot, "custom-pkg", MULTI_USE_FOLDER, "flags-test");
  assert(instructions.description).equals("A test powerup");
  assert(instructions.intent).equals(["test", "example"]);
  assert(instructions.variables.required).equals(["name", "value"]);
  assert(instructions.variables.optional).equals(["optional1", "optional2"]);

  await cleanup();
});

test.case("package is added to project config", async assert => {
  await setupTestEnv();

  await createPowerup({
    name: "config-test",
    projectRoot: testRoot,
  });

  const config = await testRoot
    .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
    .json() as Record<string, unknown>;
  assert((config.packages as string[]).includes("test-project")).true();

  await cleanup();
});