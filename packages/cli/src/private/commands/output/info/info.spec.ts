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

test.case("info prints required and optional variables", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "api-route" },
      { flag: "--description", value: "An API route template" },
      { flag: "--variables", value: "name,method" },
      { flag: "--optional-variables", value: "middleware" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["api-route"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Variables");
  assert(output).includes("### Required");
  assert(output).includes("`--name=<value>`");
  assert(output).includes("`--method=<value>`");
  assert(output).includes("### Optional");
  assert(output).includes("`--middleware=<value>`");
  assert(output).includes("[--middleware=<value>]");

  await testRoot.remove();
});

test.case("info prints create, modify, and delete files", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "full-output" },
      { flag: "--description", value: "A template with all file types" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "component",
          template: "component.njk",
          outputPath: "src/{{ComponentName}}.tsx",
        }],
        modify: [{
          name: "index",
          template: "index.json",
          outputPath: "src/index.ts",
        }],
        delete: [{
          name: "old-file",
          outputPath: "src/legacy.ts",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["full-output"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Files");
  assert(output).includes("### Create");
  assert(output).includes("`src/{{ComponentName}}.tsx` (template: `component.njk`)");
  assert(output).includes("### Modify");
  assert(output).includes("`src/index.ts` (template: `index.json`)");
  assert(output).includes("### Delete");
  assert(output).includes("`src/legacy.ts`");

  await testRoot.remove();
});

test.case("info prints package dependencies", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "add-tailwind" },
      { flag: "--description", value: "Adds tailwind to a project" },
      { flag: "--variables", value: "name" },
      { flag: "--package-deps", value: JSON.stringify([
        {
          target: "packages/web",
          dependencies: ["tailwindcss@^4.0.0"],
          devDependencies: ["@types/tailwindcss@^3.0.0"],
        },
      ]) },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["add-tailwind"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Dependencies");
  assert(output).includes("tailwindcss@^4.0.0 (target: packages/web)");
  assert(output).includes("@types/tailwindcss@^3.0.0 (devDependency, target: packages/web)");

  await testRoot.remove();
});

test.case("info omits empty sections when template has no files, deps, or includes", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "simple-template" },
      { flag: "--description", value: "A simple template" },
      { flag: "--variables", value: "name" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["simple-template"],
    flags: [],
    context: { root: testRoot },
  }));

  // These sections should NOT appear since the template has no output files,
  // no dependencies, no includes, and no optional variables.
  assert(output.includes("## Files")).false();
  assert(output.includes("## Dependencies")).false();
  assert(output.includes("## Includes")).false();
  assert(output.includes("### Optional")).false();

  await testRoot.remove();
});