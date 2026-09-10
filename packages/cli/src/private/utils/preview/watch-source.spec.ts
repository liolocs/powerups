import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { snapshotsDiffer, takeSourceSnapshot } from "#utils/preview/watch-source";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/watch-source");

test.case("snapshot covers src/, fixtures/, index.ts, preview.json", async assert => {
  await fs.create(testRoot);
  await fs.create(testRoot.append("/src/dynamic-create"));
  await testRoot.append("/src/dynamic-create/a.ts").write("1");
  await testRoot.append("/fixtures/base.txt").write("1");
  await testRoot.append("/index.ts").write("1");
  await testRoot.append("/preview.json").write("{}");

  const snapshot = await takeSourceSnapshot({ powerupRoot: testRoot });

  assert(snapshot.has("src/dynamic-create/a.ts")).true();
  assert(snapshot.has("fixtures/base.txt")).true();
  assert(snapshot.has("index.ts")).true();
  assert(snapshot.has("preview.json")).true();

  await testRoot.remove({ recursive: true });
});

test.case("snapshotsDiffer detects changed files", async assert => {
  const previous = new Map([["a", 1]]);
  const same = new Map([["a", 1]]);
  const changed = new Map([["a", 2]]);

  assert(snapshotsDiffer({ previous, current: same })).false();
  assert(snapshotsDiffer({ previous, current: changed })).true();
});

test.case("snapshot watches the package.json-mapped instructions entry", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/package.json").writeJSON({
    name: "watch-entry-test",
    powerup: { instructions: "src/instructions.ts" },
  });
  await fs.create(testRoot.append("/src"));
  await testRoot.append("/src/instructions.ts").write("1");
  await testRoot.append("/preview.json").write("{}");

  const snapshot = await takeSourceSnapshot({ powerupRoot: testRoot });

  assert(snapshot.has("src/instructions.ts")).true();
  assert(snapshot.has("preview.json")).true();
  assert(snapshot.has("index.ts")).false();

  await testRoot.remove({ recursive: true });
});
