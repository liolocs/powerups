import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import saveManifest from "#utils/use/run-powerup/save-manifest";
import { type ManifestEntry } from "@liolocs/powerups-sdk";
import { CLI_FOLDER_NAME } from "#constants";

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

  const manifest: ManifestEntry = {
    powerupName: "test-powerup",
    version: "1.0.0",
    location: "~/.powerups/stores/npm/test-powerup/",
    type: "multi-use",
    timestamp: new Date(),
    stepName: "create-app",
    stepType: "create",
    status: "applied",
    output: {
      type: "create",
      path: "src/App.tsx",
      action: "create",
      characterCount: 412,
    },
  };
  await assert(saveManifest({ destination: testRoot, manifest })).noErrorAsync();
  const manifestRef = testRoot.append(`/${CLI_FOLDER_NAME}/manifest.jsonl`);
  assert(await manifestRef.exists()).true();

  const entries = await manifestRef.json() as unknown as ManifestEntry[];
  assert(entries.length).equals(1);
  assert(entries[0].powerupName).equals("test-powerup");
  assert(entries[0].version).equals("1.0.0");
  assert(entries[0].location).equals("~/.powerups/stores/npm/test-powerup/");
  assert(entries[0].type).equals("multi-use");
  assert(typeof entries[0].timestamp === "string").true();
  assert(entries[0].stepName).equals("create-app");
  assert(entries[0].stepType).equals("create");
  assert(entries[0].status).equals("applied");
  assert(entries[0].output.type).equals("create");

  const output = entries[0].output;

  if (output.type === "create") {
    assert(output.path).equals("src/App.tsx");
    assert(output.action).equals("create");
    assert(output.characterCount).equals(412);
  }

  await cleanup();
});