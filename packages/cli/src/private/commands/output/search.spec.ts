import test from "@rcompat/test";
import createSearchCommand from "#commands/output/search";
import createCreateCommand from "#commands/output/create";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";
import output_search_errors, { OutputTemplateSearchErrorCode } from "#errors/outputSearchErrors";
import { OutputTemplateCreateErrorCode } from "#errors/outputCreateErrors";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);

const search = createSearchCommand("template");
const createCmd = createCreateCommand("template");

test.case("search finds matching templates", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--intent", value: "ui,component" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        create: [
          { name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          },
        ],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "api-route" },
      { flag: "--intent", value: "api,route" },
      { flag: "--variables", value: "RouteName" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component" }],
    context: { root: testRoot },
  }));

  assert(output).includes("ui-component");
  assert(output).includes("score: 1");

  await testRoot.remove();
});

test.case("search ranks by score descending", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "focused" },
      { flag: "--intent", value: "component" },
    ],
    context: { root: testRoot },
  });

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "broad" },
      { flag: "--intent", value: "component,ui,state" },
      { flag: "--output", value: JSON.stringify({
        create: [{ name: "a", template: "a", outputPath: "a" }],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component ui" }],
    context: { root: testRoot },
  }));

  const focusedPos = output.indexOf("focused");
  const broadPos = output.indexOf("broad");

  // broad should appear first (score 2) then focused (score 1)
  assert(focusedPos > broadPos).true();

  await testRoot.remove();
});

test.case("search errors when no templates match", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--intent", value: "ui,component" },
    ],
    context: { root: testRoot },
  });

  let threw = false;
  try {
    await search.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "nonexistent" }],
      context: { root: testRoot },
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("search errors without .saved folder", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw;

  try {
    await search.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "component" }],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }

  assert(threw).equals(OutputTemplateCreateErrorCode.dry_folder_not_found);

  await testRoot.remove();
});