import test from "@rcompat/test";
import {
  appliedManifestSchema,
  appliedEntrySchema,
} from "#schemas/applied";

const validEntry = {
  powerup: "@powerups/primate-init",
  name: "primate-init",
  version: "2.0.0",
  location: "global",
  appliedAt: "2026-07-30T12:00:00Z",
  variables: { name: "my-app" },
  files: [
    { path: "src/app.ts", action: "create" },
    { path: "package.json", action: "modify" },
  ],
};

test.case("schema accepts a valid manifest", assert => {
  const manifest = appliedManifestSchema.parse({
    version: 1,
    applied: [validEntry],
  });
  assert(manifest.applied.length).equals(1);
  assert(manifest.applied[0].powerup).equals("@powerups/primate-init");
});

test.case("schema accepts an empty manifest", assert => {
  const manifest = appliedManifestSchema.parse({ version: 1, applied: [] });
  assert(manifest.applied.length).equals(0);
});

test.case("schema rejects an unknown file action", assert => {
  try {
    appliedEntrySchema.parse({
      ...validEntry,
      files: [{ path: "x.ts", action: "rename" }],
    });
    assert(true).false(); // must throw
  } catch {
    assert(true).true();
  }
});

test.case("schema rejects a missing version field", assert => {
  const entry = { ...validEntry } as Record<string, unknown>;
  delete entry.version;
  try {
    appliedEntrySchema.parse(entry);
    assert(true).false();
  } catch {
    assert(true).true();
  }
});

test.case("schema accepts optional dependsOn", assert => {
  const entry = appliedEntrySchema.parse({
    ...validEntry,
    dependsOn: ["@powerups/base-init@^1.0.0"],
  });
  assert(entry.dependsOn!.length).equals(1);
});