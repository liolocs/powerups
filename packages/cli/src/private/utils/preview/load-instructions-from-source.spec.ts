import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/load-instructions");

test.case("loads and returns the instructions module from source", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "loader-test",`,
    `  type: "single-use",`,
    `  description: "loads",`,
    `  variables: { required: [], optional: [] },`,
    `  intent: [],`,
    `  steps: [],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const instructions = await loadInstructionsFromSource({ powerupRoot: testRoot });

  assert(instructions.name).equals("loader-test");

  await testRoot.remove({ recursive: true });
});

test.case("throws instructions_not_found when index.ts is missing", async assert => {
  await fs.create(testRoot);

  try {
    await loadInstructionsFromSource({ powerupRoot: testRoot });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("instructions_not_found");
  }

  await testRoot.remove({ recursive: true });
});

test.case("loads from the package.json powerup.instructions entry", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/package.json").writeJSON({
    name: "entry-loader-test",
    powerup: { instructions: "src/instructions.ts" },
  });
  await fs.create(testRoot.append("/src"));
  await testRoot.append("/src/instructions.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "custom-entry-test",`,
    `  type: "single-use",`,
    `  description: "loads from a mapped entry",`,
    `  variables: { required: [], optional: [] },`,
    `  intent: [],`,
    `  steps: [],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const instructions = await loadInstructionsFromSource({ powerupRoot: testRoot });

  assert(instructions.name).equals("custom-entry-test");

  await testRoot.remove({ recursive: true });
});
