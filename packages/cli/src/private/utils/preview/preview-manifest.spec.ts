import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { hashFile, readPreviewManifest, writePreviewManifest } from "#utils/preview/preview-manifest";
import { computeStalePaths } from "#utils/preview/compute-stale-paths";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-manifest");

test.case("manifest round-trips and tolerates a missing or corrupt file", async assert => {
  await fs.create(testRoot);

  assert(Object.keys(await readPreviewManifest({ previewDir: testRoot })).length).equals(0);

  await writePreviewManifest({ previewDir: testRoot, manifest: { "a.txt": "hash-a" } });
  const read = await readPreviewManifest({ previewDir: testRoot });
  assert(read["a.txt"]).equals("hash-a");

  await testRoot.append("/.preview-manifest.json").write("{ corrupt");
  assert(Object.keys(await readPreviewManifest({ previewDir: testRoot })).length).equals(0);

  await testRoot.remove({ recursive: true });
});

test.case("hashFile is stable for identical content", async assert => {
  await fs.create(testRoot);
  const fileRef = testRoot.append("/same.txt");
  await fileRef.write("identical");

  const first = await hashFile({ path: fileRef });
  await fileRef.write("identical");
  const second = await hashFile({ path: fileRef });

  assert(first).equals(second);
  assert(first.length).equals(64);

  await testRoot.remove({ recursive: true });
});

test.case("computeStalePaths returns previously generated paths that are no longer generated", async assert => {
  const stalePaths = computeStalePaths({
    previousManifest: { "a.txt": "h1", "b.txt": "h2", "node_modules/x.js": "h3" },
    currentGeneratedPaths: ["b.txt"],
  });

  assert(stalePaths.sort()).equals(["a.txt", "node_modules/x.js"]);
});
