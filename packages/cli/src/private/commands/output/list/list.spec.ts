import test from "@rcompat/test";
import createListCommand from "#commands/output/list/index";
import createCreateCommand from "#commands/output/create/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";
import { OutputTemplateListErrorCode } from "#errors/outputListErrors";
import { OutputTemplateCreateErrorCode } from "#errors/outputCreateErrors";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);

const listCmd = createListCommand("template");
const createCmd = createCreateCommand("template");

test.case("list prints names of all templates", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "ui,component" },
    ],
    context: { root: testRoot },
  });

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "api-route" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "api,route" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => listCmd.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("ui-component");
  assert(output).includes("api-route");

  await testRoot.remove();
});

test.case("list prints a single template name", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "solo-template" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "solo" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => listCmd.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("solo-template");

  await testRoot.remove();
});

test.group("list errors", () => {
  test.case("should fail with no_matching when no templates exist", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await fs.create(mainFolder);

    let threw;
    try {
      await listCmd.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateListErrorCode.no_matching);

    await testRoot.remove();
  });

  test.case(`should fail with dry_folder_not_found without .${MAIN_FOLDER} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await listCmd.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateCreateErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });
});