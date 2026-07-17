import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import validate from "#commands/validate/index";
import create from "#commands/create/index";
import { CreateErrorCode } from "#errors/createErrors";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
import { MAIN_FOLDER, ACTIVE_FOLDER, MULTI_USE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const multiUseFolder: FileRef = mainFolder.append(`/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);

const createCmd = create;

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

async function outputPath(name: string): Promise<FileRef> {
  return multiUseFolder.append(`/${name}/instructions.json`);
}

test.case("validate --name reports a single valid template", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
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
  test.case(`should fail with dry_folder_not_found without ${MAIN_FOLDER}} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await validate.run({
        subcommands: ["some-power"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });


  test.case("should fail with invalid for a missing template file", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--type", value: "multi-use" },
        { flag: "--name", value: "missing-template" },
      { flag: "--description", value: "test description" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
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
      output: { create: [], modify: [] },
      includes: [{ name: "nonexistent", variables: {} }],
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
