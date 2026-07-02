import test from "@rcompat/test";
import search from "#commands/pattern/search";
import generate from "#commands/pattern/generate";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const mainFolder = root.append(`/${MAIN_FOLDER}`);

test.case("search finds matching patterns", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  await fs.create(mainFolder);

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--intent", value: "ui,component" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        files: [
          { name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          },
        ],
      }) },
    ],
  });

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "api-route" },
      { flag: "--intent", value: "api,route" },
      { flag: "--variables", value: "RouteName" },
    ],
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component" }],
  }));

  assert(output).includes("ui-component");
  assert(output).includes("score: 1");

  await mainFolder.remove();
});

test.case("search ranks by score descending", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  await fs.create(mainFolder);

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "focused" },
      { flag: "--intent", value: "component" },
    ],
  });

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "broad" },
      { flag: "--intent", value: "component,ui,state" },
      { flag: "--output", value: JSON.stringify({
        files: [{ name: "a", template: "a", outputPath: "a" }],
      }) },
    ],
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component ui" }],
  }));

  const focusedPos = output.indexOf("focused");
  const broadPos = output.indexOf("broad");

  // broad should appear first (score 2) then focused (score 1)
  assert(focusedPos > broadPos).true();

  await mainFolder.remove();
});

test.case("search errors when no patterns match", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  await fs.create(mainFolder);

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--intent", value: "ui,component" },
    ],
  });

  let threw = false;
  try {
    await search.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "nonexistent" }],
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await mainFolder.remove();
});

test.case("search errors without .dry folder", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }

  let threw = false;
  try {
    await search.run({
      subcommands: [],
      flags: [{ flag: "--query", value: "component" }],
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);
});