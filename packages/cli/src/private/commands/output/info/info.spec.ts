import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import createInfoCommand from "#commands/output/info/index";
import createCreateCommand from "#commands/output/create/index";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { OutputTemplateInfoErrorCode } from "#errors/outputInfoErrors";
import { MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);

const infoCmd = createInfoCommand("template");
const createCmd = createCreateCommand("template");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

test.case("info prints name, description, intent, and usage", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "A UI component template" },
      { flag: "--intent", value: "ui,component" },
      { flag: "--variables", value: "ComponentName" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["ui-component"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("# ui-component");
  assert(output).includes("A UI component template");
  assert(output).includes("## Intent");
  assert(output).includes("ui, component");
  assert(output).includes("## Usage");
  assert(output).includes("saved template apply ui-component --component-name=<value>");

  await testRoot.remove();
});