import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { readManifest, appendManifestEntry, hasBeenApplied, type ManifestEntry } from "#utils/manifest";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-manifest-tmp");

async function freshProject(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await dir.append("/.powerups").directory.create();
  return dir;
}

const entry = (name: string, type: "multi-use" | "single-use" = "multi-use"): ManifestEntry => ({
  powerup: name,
  package: name,
  version: "1.0.0",
  location: "local",
  type,
  timestamp: new Date().toISOString(),
  variables: {},
  steps: [],
  files: [],
});

test.case("readManifest returns empty for missing file", async assert => {
  const dir = await freshProject();
  const m = await readManifest(dir);
  assert(m.length).equals(0);
  await dir.remove({ recursive: true });
});

test.case("appendManifestEntry then readManifest round-trips", async assert => {
  const dir = await freshProject();
  await appendManifestEntry(dir, entry("foo"));
  const m = await readManifest(dir);
  assert(m.length).equals(1);
  assert(m[0].powerup).equals("foo");
  await dir.remove({ recursive: true });
});

test.case("hasBeenApplied matches by powerup name", async assert => {
  const dir = await freshProject();
  await appendManifestEntry(dir, entry("foo", "single-use"));
  assert(await hasBeenApplied(dir, "foo")).true();
  assert(await hasBeenApplied(dir, "bar")).false();
  await dir.remove({ recursive: true });
});

test.case("readManifest skips unparseable lines with a warning", async assert => {
  const dir = await freshProject();
  const ref = dir.append("/.powerups/manifest.jsonl");
  await ref.write("not json\n");
  await appendManifestEntry(dir, entry("ok"));
  const m = await readManifest(dir);
  assert(m.length).equals(1);
  assert(m[0].powerup).equals("ok");
  await dir.remove({ recursive: true });
});