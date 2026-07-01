import test from "@rcompat/test";
import search from "#recipe/search";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import captureStdout from "#test-utils/capture-stdout";

const root = await runtime.projectRoot();
const dryFolder = root.append("/.dry");
const recipesFolder = dryFolder.append("/recipes");


test.case("search finds matching recipes", async assert => {
  if (await fs.exists(dryFolder)) {
    await dryFolder.remove();
  }
  await fs.create(dryFolder);
  await fs.create(recipesFolder);

  await recipesFolder.append("/ui-component.json").writeJSON({
    name: "ui-component",
    variables: ["ComponentName"],
    intent: ["ui", "component"],
    output: {
      files: [
        { name: "button.svelte",
          template: "button.svelte.tmpl",
          outputPath: "src/{{ComponentName}}.svelte",
        },
      ],
    },
  });

  await recipesFolder.append("/api-route.json").writeJSON({
    name: "api-route",
    variables: ["RouteName"],
    intent: ["api", "route"],
    output: { files: [] },
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component" }],
  }));

  assert(output).includes("ui-component");
  assert(output).includes("score: 1");

  await dryFolder.remove();
});

test.case("search ranks by score descending", async assert => {
  if (await fs.exists(dryFolder)) {
    await dryFolder.remove();
  }
  await fs.create(dryFolder);
  await fs.create(recipesFolder);

  await recipesFolder.append("/focused.json").writeJSON({
    name: "focused",
    variables: [],
    intent: ["component"],
    output: { files: [] },
  });

  await recipesFolder.append("/broad.json").writeJSON({
    name: "broad",
    variables: [],
    intent: ["component", "ui", "state"],
    output: { files: [{ name: "a", template: "a", outputPath: "a" }] },
  });

  const output = await captureStdout(() => search.run({
    subcommands: [],
    flags: [{ flag: "--query", value: "component ui" }],
  }));

  const focusedPos = output.indexOf("focused");
  const broadPos = output.indexOf("broad");

  // broad should appear first (score 2) then focused (score 1)
  assert(focusedPos > broadPos).true();

  await dryFolder.remove();
});

test.case("search errors when no recipes match", async assert => {
  if (await fs.exists(dryFolder)) {
    await dryFolder.remove();
  }
  await fs.create(dryFolder);
  await fs.create(recipesFolder);

  await recipesFolder.append("/ui-component.json").writeJSON({
    name: "ui-component",
    variables: [],
    intent: ["ui", "component"],
    output: { files: [] },
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

  await dryFolder.remove();
});

test.case("search errors without .dry folder", async assert => {
  if (await fs.exists(dryFolder)) {
    await dryFolder.remove();
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