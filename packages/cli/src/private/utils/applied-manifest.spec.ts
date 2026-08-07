import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { POWERUP_MANIFEST_FILE_NAME, CLI_FOLDER_NAME } from "#constants";
import {
  readAppliedManifest,
  writeAppliedManifest,
  recordApplication,
} from "#utils/applied-manifest";

function freshRoot(): FileRef {
  return fs.ref(path.join(tmpdir(), `applied-test-${randomUUID()}`));
}

async function cleanup(root: FileRef) {
  await root.remove().catch(() => {});
}

const baseArgs = (root: FileRef) => ({
  root,
  powerup: "@powerups/widget",
  name: "widget",
  version: "1.0.0",
  location: "global" as const,
  variables: { name: "foo" },
  changedFiles: [{ path: "src/widget.ts", action: "create" as const }],
});

test.case("read returns empty manifest when file is missing", async assert => {
  const root = freshRoot();
  const manifest = await readAppliedManifest(root);
  assert(manifest.version).equals(1);
  assert(manifest.applied.length).equals(0);
  await cleanup(root);
});

test.case("write then read round-trips", async assert => {
  const root = freshRoot();
  await writeAppliedManifest(root, {
    version: 1,
    applied: [{
      powerup: "@powerups/widget", name: "widget", version: "1.0.0",
      location: "global", appliedAt: "2026-07-30T00:00:00Z",
      variables: {}, files: [],
    }],
  });
  const manifest = await readAppliedManifest(root);
  assert(manifest.applied.length).equals(1);
  assert(manifest.applied[0].powerup).equals("@powerups/widget");
  await cleanup(root);
});

test.case("read throws corrupt_manifest on invalid JSON", async assert => {
  const root = freshRoot();
  await fs.create(root.append(`/${CLI_FOLDER_NAME}`));
  await root.append(`/${CLI_FOLDER_NAME}/${POWERUP_MANIFEST_FILE_NAME}`).write("{ not json");
  try {
    await readAppliedManifest(root);
    assert(true).false(); // must throw
  } catch (e) {
    assert((e as { code?: string }).code).equals("corrupt_manifest");
  }
  await cleanup(root);
});

test.case("recordApplication adds a new entry", async assert => {
  const root = freshRoot();
  const manifest = await recordApplication(baseArgs(root));
  assert(manifest.applied.length).equals(1);
  assert(manifest.applied[0].files.length).equals(1);
  assert(manifest.applied[0].files[0].path).equals("src/widget.ts");
  // persisted to disk
  const read = await readAppliedManifest(root);
  assert(read.applied.length).equals(1);
  await cleanup(root);
});

test.case("recordApplication replaces entry with same variables (multi-use)", async assert => {
  const root = freshRoot();
  await recordApplication(baseArgs(root));
  const manifest = await recordApplication({
    ...baseArgs(root),
    version: "1.1.0",
    changedFiles: [{ path: "src/widget2.ts", action: "create" as const }],
  });
  assert(manifest.applied.length).equals(1);
  assert(manifest.applied[0].version).equals("1.1.0");
  assert(manifest.applied[0].files[0].path).equals("src/widget2.ts");
  await cleanup(root);
});

test.case("recordApplication appends entry with different variables (multi-use)", async assert => {
  const root = freshRoot();
  await recordApplication(baseArgs(root));
  const manifest = await recordApplication({
    ...baseArgs(root),
    variables: { name: "bar" },
  });
  assert(manifest.applied.length).equals(2);
  await cleanup(root);
});

test.case("singleUse: true replaces entry even with different variables", async assert => {
  const root = freshRoot();
  await recordApplication(baseArgs(root));
  const manifest = await recordApplication({
    ...baseArgs(root),
    singleUse: true,
    variables: { name: "bar" },
  });
  assert(manifest.applied.length).equals(1);
  assert(manifest.applied[0].variables.name).equals("bar");
  await cleanup(root);
});

test.case("deleted files are removed from other entries", async assert => {
  const root = freshRoot();
  await recordApplication(baseArgs(root)); // owns src/widget.ts
  const manifest = await recordApplication({
    ...baseArgs(root),
    powerup: "@powerups/cleanup", name: "cleanup",
    variables: {},
    changedFiles: [{ path: "src/widget.ts", action: "delete" as const }],
  });
  const widget = manifest.applied.find(e => e.powerup === "@powerups/widget")!;
  assert(widget.files.length).equals(0);
  const cleanupEntry = manifest.applied
    .find(e => e.powerup === "@powerups/cleanup")!;
  assert(cleanupEntry.files[0].action).equals("delete");
  await cleanup(root);
});

test.case("variable key order does not affect replace matching", async assert => {
  const root = freshRoot();
  await recordApplication({ ...baseArgs(root), variables: { a: "1", b: "2" } });
  const manifest = await recordApplication({ ...baseArgs(root), variables: { b: "2", a: "1" } });
  assert(manifest.applied.length).equals(1);
  await cleanup(root);
});