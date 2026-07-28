import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { copyActiveStructure, copySubPowerUps } from "#utils/move/copy";
import type { CollectedSubPowerUp } from "#utils/move/collect";
import {
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/move-copy-spec");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

/**
 * Build a source src/active tree with powerup folders, instructions.json,
 * and files that include both flat files AND nested sub-folders.
 */
async function buildSourceTree(srcActive: FileRef): Promise<void> {
  // multi-use/my-powerup/
  const powerDir = srcActive.append(`/${MULTI_USE_FOLDER}/my-powerup`);
  await fs.create(powerDir);
  await powerDir.append("/instructions.json").writeJSON({
    name: "my-powerup",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [],
  });

  // flat file AND a nested sub-folder containing a file
  await powerDir.append("/flat.txt").write("flat content");

  const nestedDir = powerDir.append("/nested/sub");
  await fs.create(nestedDir);
  await nestedDir.append("/deep.txt").write("deep content");

  // single-use/other-power/ (no template)
  const otherDir = srcActive.append(`/${SINGLE_USE_FOLDER}/other-power`);
  await fs.create(otherDir);
  await otherDir.append("/instructions.json").writeJSON({
    name: "other-power",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [],
  });
}

test.group("copyActiveStructure", () => {
  test.case("copies powerup directories (not just files)", async assert => {
    await reset();
    const srcActive = testRoot.append("/src-active");
    const destActive = testRoot.append("/dest-active");
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
    await buildSourceTree(srcActive);

    await copyActiveStructure({ srcActiveDir: srcActive, destSrcActiveDir: destActive });

    // The core bug: powerup folders are directories, files() returned [].
    // After fix (dirs()), the power dir should exist at destination.
    assert(await fs.exists(destActive.append(`/${MULTI_USE_FOLDER}/my-powerup`))).true();
    assert(await fs.exists(destActive.append(`/${SINGLE_USE_FOLDER}/other-power`))).true();
  });

  test.case("copies instructions.json inside each powerup folder", async assert => {
    await reset();
    const srcActive = testRoot.append("/src-active");
    const destActive = testRoot.append("/dest-active");
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
    await buildSourceTree(srcActive);

    await copyActiveStructure({ srcActiveDir: srcActive, destSrcActiveDir: destActive });

    const instr = await destActive
      .append(`/${MULTI_USE_FOLDER}/my-powerup/instructions.json`)
      .json() as Record<string, unknown>;
    assert(instr.name).equals("my-powerup");
  });

  test.case("copies flat files", async assert => {
    await reset();
    const srcActive = testRoot.append("/src-active");
    const destActive = testRoot.append("/dest-active");
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
    await buildSourceTree(srcActive);

    await copyActiveStructure({ srcActiveDir: srcActive, destSrcActiveDir: destActive });

    const flat = await destActive
      .append(`/${MULTI_USE_FOLDER}/my-powerup/flat.txt`)
      .text();
    assert(flat.trim()).equals("flat content");
  });

  test.case("copies nested sub-folders and their files", async assert => {
    await reset();
    const srcActive = testRoot.append("/src-active");
    const destActive = testRoot.append("/dest-active");
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
    await buildSourceTree(srcActive);

    await copyActiveStructure({ srcActiveDir: srcActive, destSrcActiveDir: destActive });

    // This is the second bug: files() only returned flat files, missing
    // nested directories entirely. After fix (copy()), the deep file
    // should exist.
    const deep = await destActive
      .append(`/${MULTI_USE_FOLDER}/my-powerup/nested/sub/deep.txt`)
      .text();
    assert(deep.trim()).equals("deep content");
  });

  test.case("handles missing type folder gracefully", async assert => {
    await reset();
    const srcActive = testRoot.append("/src-active");
    const destActive = testRoot.append("/dest-active");
    // Only create multi-use, leave single-use absent
    await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
    const powerDir = srcActive.append(`/${MULTI_USE_FOLDER}/solo`);
    await fs.create(powerDir);
    await powerDir.append("/instructions.json").writeJSON({
      name: "solo",
      description: "test",
      variables: { required: [] },
      intent: [],
      steps: [],
    });

    await copyActiveStructure({ srcActiveDir: srcActive, destSrcActiveDir: destActive });

    assert(await fs.exists(destActive.append(`/${MULTI_USE_FOLDER}/solo`))).true();
    // single-use folder simply won't exist — no crash
    assert(await fs.exists(destActive.append(`/${SINGLE_USE_FOLDER}`))).false();
  });
});

test.group("copySubPowerUps", () => {
  test.case("copies sub-powerup folders into the correct type dir", async assert => {
    await reset();
    const destActive = testRoot.append("/dest-active");
    await fs.create(destActive.append(`/${MULTI_USE_FOLDER}`));

    // Build a fake sub-powerup source folder
    const subSrc = testRoot.append("/sub-src/my-sub");
    await fs.create(subSrc);
    await subSrc.append("/instructions.json").writeJSON({
      name: "my-sub",
      description: "test",
      variables: { required: [] },
      intent: [],
      steps: [],
    });

    const collected = new Map<string, CollectedSubPowerUp>([
      ["my-sub", {
        folder: subSrc,
        type: "multi-use",
        parent: "my-powerup",
      }],
    ]);

    await copySubPowerUps({ collected, destSrcActiveDir: destActive });

    assert(await fs.exists(destActive.append(`/${MULTI_USE_FOLDER}/my-sub`))).true();
    const instr = await destActive
      .append(`/${MULTI_USE_FOLDER}/my-sub/instructions.json`)
      .json() as Record<string, unknown>;
    assert(instr.name).equals("my-sub");
  });

  test.case("skips sub-powerups that already exist at destination", async assert => {
    await reset();
    const destActive = testRoot.append("/dest-active");
    await fs.create(destActive.append(`/${MULTI_USE_FOLDER}`));

    // Pre-create the destination sub folder with existing content
    const existingDest = destActive.append(`/${MULTI_USE_FOLDER}/existing-sub`);
    await fs.create(existingDest);
    await existingDest.append("/instructions.json").write("EXISTING");

    // Build a source that would overwrite
    const subSrc = testRoot.append("/sub-src/existing-sub");
    await fs.create(subSrc);
    await subSrc.append("/instructions.json").write("SHOULD_NOT_OVERWRITE");

    const collected = new Map<string, CollectedSubPowerUp>([
      ["existing-sub", {
        folder: subSrc,
        type: "multi-use",
        parent: "my-powerup",
      }],
    ]);

    await copySubPowerUps({ collected, destSrcActiveDir: destActive });

    const content = await destActive
      .append(`/${MULTI_USE_FOLDER}/existing-sub/instructions.json`)
      .text();
    assert(content.trim()).equals("EXISTING");
  });
});