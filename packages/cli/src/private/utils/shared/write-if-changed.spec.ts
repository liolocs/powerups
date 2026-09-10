import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import writeIfChanged from "#utils/shared/write-if-changed";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/write-if-changed");

test.case("writes a new file and returns true", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/a.txt");

  const wrote = await writeIfChanged({ targetPath, content: "hello\n" });

  assert(wrote).true();
  assert(await targetPath.text()).equals("hello\n");
  await testRoot.remove({ recursive: true });
});

test.case("skips identical content (mtime preserved) and returns false", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/b.txt");
  await writeIfChanged({ targetPath, content: "same\n" });

  const statsBefore = await statMtime(targetPath);
  const wrote = await writeIfChanged({ targetPath, content: "same\n" });
  const statsAfter = await statMtime(targetPath);

  assert(wrote).false();
  assert(statsAfter).equals(statsBefore);

  await testRoot.remove({ recursive: true });
});

test.case("overwrites different content and returns true", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/c.txt");
  await writeIfChanged({ targetPath, content: "before\n" });

  const wrote = await writeIfChanged({ targetPath, content: "after\n" });

  assert(wrote).true();
  assert(await targetPath.text()).equals("after\n");

  await testRoot.remove({ recursive: true });
});

test.case("normalizes content without trailing newline for comparison", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/d.txt");
  await writeIfChanged({ targetPath, content: "raw" });

  const wrote = await writeIfChanged({ targetPath, content: "raw" });

  assert(wrote).false();
  assert(await targetPath.text()).equals("raw\n");

  await testRoot.remove({ recursive: true });
});

async function statMtime(targetPath: import("@rcompat/fs").FileRef): Promise<number> {
  const { stat } = await import("node:fs/promises");
  const stats = await stat(targetPath.path);
  return stats.mtimeMs;
}