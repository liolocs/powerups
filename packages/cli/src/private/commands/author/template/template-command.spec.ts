import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import template from "#commands/author/template/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/template-command");

async function scaffoldPowerup(): Promise<void> {
  await fs.create(testRoot);
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "convertible",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: [], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "create",`,
    `      "name": "config",`,
    `      "file": "src/create/app.conf",`,
    `      "outputPath": "app.conf"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const staticSource = testRoot.append("/src/create/app.conf");
  await fs.create(staticSource.directory);
  await staticSource.write("setting=on\n");
}

test.case("converts a static step to dynamic and rewrites index.ts", async assert => {
  await scaffoldPowerup();

  await template.run({
    subcommands: ["app.conf"],
    flags: [],
    context: { root: testRoot },
  });

  const indexContent = await testRoot.append("/index.ts").text();
  assert(indexContent).includes("\"type\": \"dynamic-create\"");
  assert(indexContent).includes("\"template\": \"src/dynamic-create/app.conf.ts\"");

  const templateContent = await testRoot.append("/src/dynamic-create/app.conf.ts").text();
  assert(templateContent).includes("`setting=on");
  assert(await testRoot.append("/src/create/app.conf").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("reverts a dynamic step back to static", async assert => {
  await scaffoldPowerup();

  await template.run({ subcommands: ["app.conf"], flags: [], context: { root: testRoot } });
  await template.run({ subcommands: ["app.conf"], flags: [{ flag: "--revert" }], context: { root: testRoot } });

  const indexContent = await testRoot.append("/index.ts").text();
  assert(indexContent).includes("\"type\": \"create\"");
  assert(await testRoot.append("/src/create/app.conf").text()).equals("setting=on\n");
  assert(await testRoot.append("/src/dynamic-create/app.conf.ts").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("step_not_found for unknown output paths", async assert => {
  await scaffoldPowerup();

  try {
    await template.run({ subcommands: ["nope.txt"], flags: [], context: { root: testRoot } });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("step_not_found");
  }

  await testRoot.remove({ recursive: true });
});
