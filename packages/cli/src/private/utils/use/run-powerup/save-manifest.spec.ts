import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import saveManifest from "#utils/use/run-powerup/save-manifest";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should successfully save the manifest", async assert => {
  await setupTestDir();

  assert().fail();
  // const manifest = {}
  // assert(saveManifest({ root: testRoot, manifest: manifest })).noErrorAsync();

  await cleanup();
});