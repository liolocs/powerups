# Applied-State Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pup use` record every applied powerup — name, pack version, location, variables, and the files it touched — in `.<CLI_NAME>/applied.json`, and make `pup doctor` verify manifest health.

**Architecture:** A pema-validated manifest schema (`schemas/applied.ts`), a small read/write/upsert utility (`utils/applied-manifest.ts`), a write hook in `use/index.ts` invoked after `copyChangedFiles` (where `changedFiles` is already available), and a manifest health check appended to `doctor`'s issue list. No new commands.

**Tech Stack:** TypeScript, pema (schemas), @rcompat/fs (FileRef), @rcompat/test + proby (tests), @rcompat/error (coded errors).

**Spec:** `docs/superpowers/specs/2026-07-30-powerups-depends-diagnose-fix-design.md` → Subsystem 1.

**Conventions discovered in the codebase (follow them exactly):**
- Errors: `error.coded({...})` factory + `error.template` (see `errors/useErrors.ts`); export `XErrorCode` map after the factory.
- Tests: `import test from "@rcompat/test"`, `test.case("name", async assert => {...})`, `assert(x).true()/.equals(y)`.
- Run one spec: `npx proby packages/cli/src/private/utils/applied-manifest.spec.ts` (run from repo root).
- FileRef API: `ref.append("/path")`, `ref.write(text)`, `ref.writeJSON(obj)`, `ref.json()`, `await fs.exists(ref)`, `await fs.text(ref)`.

---

### Task 1: `APPLIED_FILE` constant

**Files:**
- Modify: `packages/cli/src/private/constants.ts` (after the `METRICS_FILE` constant)

- [ ] **Step 1: Add the constant**

In `packages/cli/src/private/constants.ts`, directly below the `METRICS_FILE` block, add:

```ts
/** Name of the applied-state manifest, recording every powerup applied to the project. */
export const APPLIED_FILE = "applied.json";
```

- [ ] **Step 2: Verify compilation by running an existing spec**

Run: `npx proby packages/cli/src/private/utils/config.spec.ts`
Expected: PASS (`Passed: 22, Failed: 0`) — constants import cleanly.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/private/constants.ts
git commit -m "feat: add APPLIED_FILE constant for applied-state manifest"
```

---

### Task 2: Manifest schema (`schemas/applied.ts`)

**Files:**
- Create: `packages/cli/src/private/schemas/applied.ts`
- Create: `packages/cli/src/private/schemas/applied.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/schemas/applied.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx proby packages/cli/src/private/schemas/applied.spec.ts`
Expected: FAIL — `#schemas/applied` does not resolve.

- [ ] **Step 3: Implement the schema**

Create `packages/cli/src/private/schemas/applied.ts`:

```ts
import p from "pema";

export const appliedFileActionSchema = p.union(
  p.literal("create"),
  p.literal("modify"),
  p.literal("delete"),
);

export const appliedFileSchema = p({
  path: p.string,
  action: appliedFileActionSchema,
});

export const appliedEntrySchema = p({
  /** Pack name (identity), e.g. "@powerups/primate-init". */
  powerup: p.string,
  /** Powerup name as passed to `pup use`, e.g. "primate-init". */
  name: p.string,
  /** Pack version at apply time. */
  version: p.string,
  /** Whether the pack was resolved locally (project store) or globally. */
  location: p.union(p.literal("local"), p.literal("global")),
  appliedAt: p.string,
  variables: p.record(p.string, p.string),
  files: p.array(appliedFileSchema),
  dependsOn: p.array(p.string).optional(),
});

export const appliedManifestSchema = p({
  version: p.number,
  applied: p.array(appliedEntrySchema),
});

export type AppliedFileAction = (typeof appliedFileActionSchema)["infer"];
export type AppliedFile = (typeof appliedFileSchema)["infer"];
export type AppliedEntry = (typeof appliedEntrySchema)["infer"];
export type AppliedManifest = (typeof appliedManifestSchema)["infer"];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx proby packages/cli/src/private/schemas/applied.spec.ts`
Expected: PASS — `Passed: 5, Failed: 0`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/schemas/applied.ts packages/cli/src/private/schemas/applied.spec.ts
git commit -m "feat: add applied manifest schema"
```

---

### Task 3: Manifest errors (`errors/appliedErrors.ts`)

**Files:**
- Create: `packages/cli/src/private/errors/appliedErrors.ts`

- [ ] **Step 1: Create the error factory**

Create `packages/cli/src/private/errors/appliedErrors.ts` (pattern copied from `errors/createErrors.ts`):

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { APPLIED_FILE, CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const applied_errors = error.coded({
  corrupt_manifest: () => {
    const errorText =
      `${MAIN_FOLDER}/${APPLIED_FILE} is corrupt or not valid JSON. ` +
      `Re-run "${CLI_CMD} use" for the powerups you know were applied, or delete the file.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type AppliedErrorCode = keyof typeof applied_errors;

export const AppliedErrorCode = Object.fromEntries(
  Object.keys(applied_errors).map(k => [k, k]),
) as { [K in AppliedErrorCode]: K };

export default applied_errors;
```

- [ ] **Step 2: Compile check via next task's failing test**

No standalone test; the utility spec in Task 4 exercises `corrupt_manifest`. Proceed.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/private/errors/appliedErrors.ts
git commit -m "feat: add applied manifest error factory"
```

---

### Task 4: Manifest utility (`utils/applied-manifest.ts`)

**Files:**
- Create: `packages/cli/src/private/utils/applied-manifest.ts`
- Create: `packages/cli/src/private/utils/applied-manifest.spec.ts`

Responsibilities, one function each:
- `readAppliedManifest(root)` → parse or throw `corrupt_manifest`; missing file → empty manifest `{ version: 1, applied: [] }`.
- `writeAppliedManifest(root, manifest)` → serialize + write.
- `recordApplication(root, args)` → upsert entry (replace by powerup+canonical variables; replace-any for single-use semantics handled by caller passing `singleUse: true`), plus delete bookkeeping: files deleted by this application are removed from other entries' file lists.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/applied-manifest.spec.ts`:

```ts
import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { APPLIED_FILE, MAIN_FOLDER } from "#constants";
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
  await fs.create(root.append(`/${MAIN_FOLDER}`));
  await root.append(`/${MAIN_FOLDER}/${APPLIED_FILE}`).write("{ not json");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx proby packages/cli/src/private/utils/applied-manifest.spec.ts`
Expected: FAIL — `#utils/applied-manifest` does not resolve.

- [ ] **Step 3: Implement the utility**

Create `packages/cli/src/private/utils/applied-manifest.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import { APPLIED_FILE, MAIN_FOLDER } from "#constants";
import {
  appliedManifestSchema,
  type AppliedEntry,
  type AppliedFile,
  type AppliedManifest,
} from "#schemas/applied";
import applied_errors from "#errors/appliedErrors";

export interface RecordApplicationArgs {
  root: FileRef;
  /** Pack name (identity), e.g. "@powerups/primate-init". */
  powerup: string;
  /** Powerup name as passed on the CLI. */
  name: string;
  version: string;
  location: "local" | "global";
  variables: Record<string, string>;
  changedFiles: AppliedFile[];
  dependsOn?: string[];
  /** When true, replace any existing entry for this powerup regardless of variables. */
  singleUse?: boolean;
}

function manifestRef(root: FileRef): FileRef {
  return root.append(`/${MAIN_FOLDER}/${APPLIED_FILE}`);
}

const emptyManifest = (): AppliedManifest => ({ version: 1, applied: [] });

/** Canonical serialization so variable key order does not affect matching. */
function canonicalVariables(variables: Record<string, string>): string {
  const sorted = Object.keys(variables).sort()
    .map(key => [key, variables[key]]);
  return JSON.stringify(sorted);
}

/**
 * Read the applied manifest. Missing file → empty manifest.
 * Invalid JSON or schema mismatch → throws corrupt_manifest.
 */
export async function readAppliedManifest(root: FileRef): Promise<AppliedManifest> {
  const ref = manifestRef(root);
  if (!(await fs.exists(ref))) {
    return emptyManifest();
  }
  try {
    return appliedManifestSchema.parse(await ref.json());
  } catch {
    throw applied_errors.corrupt_manifest();
  }
}

/** Write the applied manifest, creating the main folder if needed. */
export async function writeAppliedManifest(
  root: FileRef,
  manifest: AppliedManifest,
): Promise<void> {
  const ref = manifestRef(root);
  await fs.create(ref.directory);
  await ref.writeJSON(manifest);
}

/**
 * Record a powerup application in the manifest and persist it.
 *
 * Upsert rules:
 * - A same-named entry with identical variables (order-insensitive) is replaced.
 * - A same-named entry with different variables is appended (multi-use), unless
 *   `singleUse: true`, in which case the first same-named entry is replaced.
 *
 * Delete bookkeeping: any file this application deleted is removed from every
 * other entry's file list (the file no longer exists to attribute).
 *
 * Returns the updated manifest.
 */
export async function recordApplication(
  args: RecordApplicationArgs,
): Promise<AppliedManifest> {
  const manifest = await readAppliedManifest(args.root);
  const { root, singleUse, dependsOn, ...rest } = args;

  const deletedPaths = args.changedFiles
    .filter(file => file.action === "delete")
    .map(file => file.path);

  // Remove deleted files from every other entry
  const others = manifest.applied.map(entry => ({
    ...entry,
    files: entry.files.filter(file => !deletedPaths.includes(file.path)),
  }));

  const entry: AppliedEntry = {
    powerup: rest.powerup,
    name: rest.name,
    version: rest.version,
    location: rest.location,
    appliedAt: new Date().toISOString(),
    variables: rest.variables,
    files: rest.changedFiles,
    ...(dependsOn ? { dependsOn } : {}),
  };

  const samePowerup = (candidate: AppliedEntry) =>
    candidate.powerup === entry.powerup && candidate.name === entry.name;

  const replaceIndex = others.findIndex(candidate =>
    samePowerup(candidate) && (singleUse === true ||
      canonicalVariables(candidate.variables) === canonicalVariables(entry.variables)));

  const applied = replaceIndex === -1
    ? [...others, entry]
    : others.map((candidate, index) => index === replaceIndex ? entry : candidate);

  const updated: AppliedManifest = { version: 1, applied };
  await writeAppliedManifest(root, updated);
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx proby packages/cli/src/private/utils/applied-manifest.spec.ts`
Expected: PASS — `Passed: 9, Failed: 0`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/applied-manifest.ts packages/cli/src/private/utils/applied-manifest.spec.ts
git commit -m "feat: add applied manifest read/write/record utility"
```

---

### Task 5: Hook `use` — write the manifest after apply

**Files:**
- Modify: `packages/cli/src/private/commands/use/index.ts` (imports; step 10 area; step 12 area)
- Modify: `packages/cli/src/private/commands/use/use.spec.ts` (add tests at end of file)

Behavior:
- After `copyChangedFiles` succeeds (non-dry-run path only), build the manifest entry and call `recordApplication`.
- Action inference per changed file: `deleted → "delete"`; else check `await fs.exists(root.append("/" + projectPath))` **before** copy (file exists → "modify", missing → "create"). Capture this classification in `use` **before** `copyChangedFiles` runs, since copy makes everything exist.
- `version`: read from the pack's `package.json` at `outputFolder.up(2)` (powerup folder → type folder → pack dir).
- `location`, `packageName`, `type` come from `resolved` (already in scope).
- Manifest write failure: warn via `cli.print`, never crash a successful run (same philosophy as `logRun`).
- Dry-run path: no manifest write.

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/src/private/commands/use/use.spec.ts` (after the last `test.case`, reusing the existing `reset`, `gitInit`, `createPowerup`, `mainFolder`, `multiUseFolder` helpers in that file):

```ts
test.case("apply records the powerup in the applied manifest",
  async assert => {
    await reset();

    await createPowerup("manifest-widget", [
      { type: "create", name: "widget.txt", template: "widget.njk", outputPath: ".test-manifest/{{Name}}.txt" },
    ], { required: ["Name"] });
    await multiUseFolder.append("/manifest-widget/widget.njk").write("hello {{Name}}");

    await use.run({
      subcommands: ["manifest-widget"],
      flags: [{ flag: "--name", value: "Foo" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const manifestRef = mainFolder.append(`/${APPLIED_FILE}`);
    assert(await fs.exists(manifestRef)).true();

    const manifest = appliedManifestSchema.parse(await manifestRef.json());
    assert(manifest.applied.length).equals(1);

    const entry = manifest.applied[0];
    assert(entry.name).equals("manifest-widget");
    assert(entry.powerup).equals("test-pkg");
    assert(entry.version).equals("1.0.0");
    assert(entry.location).equals("local");
    assert(entry.variables.Name).equals("Foo");
    assert(entry.files.length).equals(1);
    assert(entry.files[0].path).equals(".test-manifest/Foo.txt");
    assert(entry.files[0].action).equals("create");
  });

test.case("re-applying same variables replaces the manifest entry",
  async assert => {
    await reset();

    await createPowerup("manifest-reuse", [
      { type: "create", name: "a.txt", template: "a.njk", outputPath: ".test-manifest-a/{{Name}}.txt" },
    ], { required: ["Name"] });
    await multiUseFolder.append("/manifest-reuse/a.njk").write("{{Name}}");

    for (let run = 0; run < 2; run++) {
      await use.run({
        subcommands: ["manifest-reuse"],
        flags: [{ flag: "--name", value: "Bar" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
      await gitCommit(testRoot, `run ${run}`);
    }

    const manifest = appliedManifestSchema
      .parse(await mainFolder.append(`/${APPLIED_FILE}`).json());
    assert(manifest.applied.filter(e => e.name === "manifest-reuse").length)
      .equals(1);
  });

test.case("dry-run does not write the manifest", async assert => {
    await reset();

    await createPowerup("manifest-dry", [
      { type: "create", name: "d.txt", template: "d.njk", outputPath: ".test-manifest-d/{{Name}}.txt" },
    ], { required: ["Name"] });
    await multiUseFolder.append("/manifest-dry/d.njk").write("{{Name}}");

    await captureStdout(async () => {
      await use.run({
        subcommands: ["manifest-dry"],
        flags: [
          { flag: "--name", value: "Baz" },
          { flag: "--dry-run", value: "" },
        ],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    });

    assert(await fs.exists(mainFolder.append(`/${APPLIED_FILE}`))).false();
  });
```

Add these imports to the top of `use.spec.ts` (merge with existing import lists — `APPLIED_FILE` alongside the other `#constants` imports):

```ts
import { APPLIED_FILE } from "#constants";
import { appliedManifestSchema } from "#schemas/applied";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx proby packages/cli/src/private/commands/use/use.spec.ts`
Expected: FAIL — `applied.json` does not exist after apply.

- [ ] **Step 3: Implement the hook**

In `packages/cli/src/private/commands/use/index.ts`:

**a)** Add imports:

```ts
import applied_errors from "#errors/appliedErrors"; // not used directly; for completeness with other error imports — REMOVE if unused by lint
```
Do **not** add that import; instead add exactly:

```ts
import { recordApplication } from "#utils/applied-manifest";
import { PACKAGE_FILE } from "#constants"; // merge with existing constants import
```

(`PACKAGE_FILE` may already be imported or not; merge, don't duplicate.)

**b)** Insert action classification **before** `copyChangedFiles` (step 10). Replace this block:

```ts
    // 10. Copy changed files back and clean up
    await copyChangedFiles(root, changedFiles);
    await removeWorktree(root, worktree.path);
```

with:

```ts
    // 10. Classify changed files (before copy makes everything exist)
    const classifiedFiles = await Promise.all(changedFiles.map(async file => ({
      path: file.projectPath,
      action: (file.deleted === true
        ? "delete"
        : await fs.exists(root.append(`/${file.projectPath}`))
          ? "modify"
          : "create") as "create" | "modify" | "delete",
    })));

    // 11. Copy changed files back and clean up
    await copyChangedFiles(root, changedFiles);
    await removeWorktree(root, worktree.path);
```

**c)** Renumber the subsequent comment `// 11.` (packageDependencies) → `// 12.` and `// 12.` (log metrics) → `// 13.`, then after the packageDependencies block and **before** the metrics block, insert:

```ts
    // 11.5. Record the application in the applied manifest (best-effort)
    try {
      const packJsonRef = outputFolder.up(2).append(`/${PACKAGE_FILE}`);
      const packJson = await packJsonRef.json() as { version?: string };
      await recordApplication({
        root,
        powerup: resolved.packageName,
        name,
        version: packJson.version ?? "0.0.0",
        location: resolved.location,
        variables,
        changedFiles: classifiedFiles,
        singleUse: resolved.type === "single-use",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cli.print(`Warning: could not record applied manifest entry — ${message}\n`);
    }
```

Note: renumber the inserted comment to `// 12.` to sit cleanly after the packageDependencies step, and shift the metrics comment to `// 13.`. Exact comment numbers are cosmetic; code order is what matters: classify → copy → packageDependencies → recordApplication → logRun.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx proby packages/cli/src/private/commands/use/use.spec.ts`
Expected: PASS — all cases including the 3 new ones.

- [ ] **Step 5: Run the full CLI test suite for regressions**

Run: `npx proby packages/cli`
Expected: PASS — zero failures across all specs.

- [ ] **Step 6: Lint**

Run: `cd packages/cli && npx eslint .`
Expected: no new errors (fix any flagged unused imports from the renumbering).

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/private/commands/use/index.ts packages/cli/src/private/commands/use/use.spec.ts
git commit -m "feat: record applied powerups in applied.json manifest"
```

---

### Task 6: `pup doctor` manifest health check

**Files:**
- Modify: `packages/cli/src/private/commands/doctor/index.ts` (after folder-structure section, ~line 80)
- Modify: `packages/cli/src/private/commands/doctor/doctor.spec.ts` (append tests)

Behavior: after the existing folder-structure checks, attempt `readAppliedManifest(root)`. Missing file → no issue (no powerups applied yet is fine). `corrupt_manifest` → `ERROR` issue of type `manifest`. Parse successfully → verify every non-deleted file entry references an existing project file; each missing file → `WARN` ("file recorded for <powerup> no longer exists: <path>").

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/src/private/commands/doctor/doctor.spec.ts`, following that file's existing setup pattern (reuse its test-root/reset helpers — mirror how its other cases construct `mainFolder`; adjust the paths below to match the spec file's local variable names if they differ):

```ts
test.case("doctor warns when manifest references a missing file",
  async assert => {
    // ...replicate the spec's standard reset/setup...
    await mainFolder.append(`/${APPLIED_FILE}`).writeJSON({
      version: 1,
      applied: [{
        powerup: "@powerups/widget", name: "widget", version: "1.0.0",
        location: "global", appliedAt: "2026-07-30T00:00:00Z",
        variables: {},
        files: [{ path: "src/ghost.ts", action: "create" }],
      }],
    });

    const output = await captureStdout(() =>
      doctor.run({ context: { root: testRoot } }));
    assert(output.includes("src/ghost.ts")).true();
    assert(output.includes("WARN")).true();
  });

test.case("doctor errors on a corrupt manifest", async assert => {
    // ...standard reset/setup...
    await mainFolder.append(`/${APPLIED_FILE}`).write("{ broken");
    const output = await captureStdout(() =>
      doctor.run({ context: { root: testRoot } }));
    assert(output.toLowerCase().includes("manifest")).true();
  });
```

Add imports (merge with existing): `import { APPLIED_FILE } from "#constants";` and `captureStdout` from `#test-utils/capture-stdout` if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx proby packages/cli/src/private/commands/doctor/doctor.spec.ts`
Expected: FAIL — no manifest output exists yet.

- [ ] **Step 3: Implement the check**

In `packages/cli/src/private/commands/doctor/index.ts`:

**a)** Add imports:

```ts
import { APPLIED_FILE } from "#constants"; // merge with existing constants import
import { readAppliedManifest } from "#utils/applied-manifest";
import { AppliedErrorCode } from "#errors/appliedErrors";
```

**b)** After the folder-structure section (after the `internalFolder` scan, before issue printing), insert:

```ts
    // Manifest health
    const manifestRef = mainFolder.append(`/${APPLIED_FILE}`);
    if (await fs.exists(manifestRef)) {
      try {
        const manifest = await readAppliedManifest(root);
        for (const entry of manifest.applied) {
          for (const file of entry.files) {
            if (file.action === "delete") continue;
            if (!(await fs.exists(root.append(`/${file.path}`)))) {
              issues.push({
                level: "WARN",
                type: "manifest",
                name: entry.powerup,
                message: `File recorded for ${entry.powerup} no longer exists: ${file.path}`,
              });
            }
          }
        }
      } catch (error) {
        if ((error as { code?: string }).code === AppliedErrorCode.corrupt_manifest) {
          issues.push({
            level: "ERROR",
            type: "manifest",
            name: APPLIED_FILE,
            message: "Applied manifest is corrupt or invalid JSON",
          });
        } else {
          throw error;
        }
      }
    }
```

Verify the existing doctor tail prints `issues` generically (it does — entries carry `level`/`type`/`name`/`message`), so no print-path change is needed. Confirm WARN text appears in output; if the printer filters, add the message text to the printed line where other issues are printed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx proby packages/cli/src/private/commands/doctor/doctor.spec.ts`
Expected: PASS — including the 2 new cases.

- [ ] **Step 5: Full suite + lint**

Run: `npx proby packages/cli`
Expected: PASS — zero failures.
Run: `cd packages/cli && npx eslint .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/private/commands/doctor/index.ts packages/cli/src/private/commands/doctor/doctor.spec.ts
git commit -m "feat: doctor checks applied manifest health"
```

---

### Task 7: Documentation

**Files:**
- Modify: `packages/cli/README.md` (Concepts section)

- [ ] **Step 1: Add manifest concept**

In the Concepts section of `packages/cli/README.md`, after the **Stores** bullet, add:

```markdown
- **Applied manifest** — every `pup use` records the powerup, pack version,
  variables, and files it wrote in `.powerups/applied.json`. This powers
  diagnosis and repair workflows; don't edit it by hand.
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/README.md
git commit -m "docs: document applied manifest concept"
```

---

## Self-Review Notes (completed by author)

- **Spec coverage:** manifest file format, write-on-use idempotency, replace/append semantics, delete bookkeeping, single vs multi-use keying, corrupt-manifest guidance, doctor manifest check — all covered (Tasks 2–6). `dependsOn` field is declared optional in the schema now and populated by plan 2.
- **Placeholders:** none — every code step shows complete code.
- **Type consistency:** `AppliedEntry`/`AppliedManifest` names identical across Tasks 2/4/5/6; `recordApplication` args match between Task 4 (implementation) and Task 5 (call site); `AppliedErrorCode.corrupt_manifest` matches Task 3's factory key.
- **Risk flagged for executor:** in Task 6, the exact helper names inside `doctor.spec.ts` must be matched against the file being edited; the plan states this explicitly where it matters.
