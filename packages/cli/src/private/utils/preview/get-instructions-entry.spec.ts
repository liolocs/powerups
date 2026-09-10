import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import getInstructionsEntry from "#utils/preview/get-instructions-entry";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/get-instructions-entry");

test.case("falls back to index.ts without a package.json", async assert => {
  await fs.create(testRoot);

  assert(await getInstructionsEntry({ powerupRoot: testRoot })).equals("index.ts");

  await testRoot.remove({ recursive: true });
});

test.case("resolves the powerup.instructions entry from package.json", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/package.json").writeJSON({
    name: "entry-test",
    powerup: { instructions: "src/instructions.ts" },
  });

  assert(await getInstructionsEntry({ powerupRoot: testRoot })).equals("src/instructions.ts");

  await testRoot.remove({ recursive: true });
});

test.case("falls back to index.ts when the powerup property is absent", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/package.json").writeJSON({
    name: "entry-test",
  });

  assert(await getInstructionsEntry({ powerupRoot: testRoot })).equals("index.ts");

  await testRoot.remove({ recursive: true });
});

test.case("falls back to index.ts when the powerup property is malformed", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/package.json").writeJSON({
    name: "entry-test",
    powerup: { instructions: 42 },
  });

  assert(await getInstructionsEntry({ powerupRoot: testRoot })).equals("index.ts");

  await testRoot.remove({ recursive: true });
});