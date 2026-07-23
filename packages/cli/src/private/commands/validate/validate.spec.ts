import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import validate from "#commands/validate/index";
import create from "#commands/create/index";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CONFIG_FILE,
  CLI_NAME,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const internalFolder: FileRef = mainFolder.append(`/${INTERNAL_FOLDER}`);
const multiUseFolder: FileRef = internalFolder.append(`/test-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);

const createCmd = create;

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(internalFolder);
  // Create test package
  const pkgDir = internalFolder.append("/test-pkg");
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: "test-pkg",
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
  });
  // Create config with test-pkg listed
  await mainFolder.append(`/${CONFIG_FILE}`).writeJSON({
    packages: ["test-pkg"],
  });
}

async function outputPath(name: string): Promise<FileRef> {
  return multiUseFolder.append(`/${name}/instructions.json`);
}

test.case("validate --name reports a single valid template", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "test description" }],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => validate.run({
    subcommands: ["ui-component"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("ui-component is valid");

  await testRoot.remove();
});

test.group("validate errors", () => {
  test.case("should fail with invalid for a missing template file", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
      { flag: "--pack", value: "test-pkg" },
        { flag: "--type", value: "multi-use" },
        { flag: "--name", value: "missing-template" },
      { flag: "--description", value: "test description" },
      ],
      context: { root: testRoot },
    });

    // Overwrite instructions.json with a step referencing a missing template
    await multiUseFolder.append("/missing-template/instructions.json").writeJSON({
      name: "missing-template",
      description: "test description",
      variables: { required: ["ComponentName"] },
      intent: [],
      steps: [
        { type: "create", name: "button.svelte", template: "button.svelte.tmpl", outputPath: "src/{{ComponentName}}.svelte" },
      ],
    });

    const templatePath = multiUseFolder.append(
      "/missing-template/button.svelte.tmpl",
    );
    await templatePath.remove();

    let error: unknown;
    try {
      await validate.run({
        subcommands: ["missing-template"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (error_) {
      error = error_;
    }

    assert(error instanceof CodeError).true();
    assert((error as CodeError).code).equals("invalid");
    assert((error as Error).message).includes("button.svelte.tmpl");

    await testRoot.remove();
  });

  test.case("should fail with invalid for invalid composition in a single template", async assert => {
    await reset();

    await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "bad-parent" },
      { flag: "--description", value: "test description" }],
      context: { root: testRoot },
    });

    await (await outputPath("bad-parent")).writeJSON({
      name: "bad-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [{ type: "include",  name: "nonexistent", variables: {} }],
    });

    let error: unknown;
    try {
      await validate.run({
        subcommands: ["bad-parent"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (error_) {
      error = error_;
    }

    assert(error instanceof CodeError).true();
    assert((error as CodeError).code).equals("invalid");
    assert((error as Error).message).includes("suboutput not found: nonexistent");

    await testRoot.remove();
  });
});
