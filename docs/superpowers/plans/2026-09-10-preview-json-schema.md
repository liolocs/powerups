# Published preview.schema.json Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `preview.schema.json` in the `@liolocs/powerups-sdk` npm tarball, generated from a zod schema that becomes the single source of truth for the `preview.json` shape.

**Architecture:** A zod schema (`previewSchema`) lives beside the SDK's other schemas in `src/private/schema/preview.ts` and is exported through the public entry. A bun build script emits the JSON Schema (via zod 4's built-in `z.toJSONSchema`) into the committed artifact `packages/sdk/preview.schema.json`. The SDK `release` script regenerates and stages the artifact before commit-and-tag-version creates the release commit; the `files` whitelist ships it. The CLI drops its local `PreviewJsonFile` type and imports it from the SDK.

**Tech Stack:** zod 4 (`z.toJSONSchema`, already a dependency — no new deps), bun script runner (`--conditions @powerups/source` so `#schema/*` imports resolve to `src/` at runtime), `@rcompat/test` via proby, commit-and-tag-version.

**Spec:** `docs/superpowers/specs/2026-09-10-preview-json-schema-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/sdk/src/private/schema/preview.ts` | Create | zod schema + `PreviewJsonFile` type + `previewJsonSchema()` generator |
| `packages/sdk/src/private/schema/preview.spec.ts` | Create | Parse acceptance/rejection tests + freshness guard for the committed artifact |
| `packages/sdk/src/private/index.ts` | Modify | Re-export the schema + type (follows existing export block) |
| `packages/sdk/scripts/build-preview-schema.ts` | Create | Writes `preview.schema.json` from `previewJsonSchema()` |
| `packages/sdk/preview.schema.json` | Create (generated) | The published JSON Schema artifact |
| `packages/sdk/package.json` | Modify | `schema` script, release chain, `files` entry |
| `packages/cli/src/private/utils/preview/read-preview-json.ts` | Modify | Import `PreviewJsonFile` from `@liolocs/powerups-sdk`, drop local type |

Verification facts established during planning (do not re-litigate):

- proby passes tsconfig `customConditions` (`@powerups/source`) to the test runtime, so specs resolve `#schema/*` to `src/` — no build needed in the TDD loop.
- Plain `bun run` resolves `#schema/*` to the built `lib/` (stale-able); `bun run --conditions @powerups/source ...` resolves to `src/` (verified).
- `zod.toJSONSchema(schema, { io: "input" })` on the strict schema produces the JSON in Task 3 Step 2 (verified).
- `packages/sdk/preview.schema.json` is ignored by no gitignore rule (verified with `git check-ignore`).
- `PreviewJsonFile` is referenced only inside `read-preview-json.ts` — no other CLI file imports it.

---

### Task 1: `previewSchema` in the SDK (TDD)

**Files:**
- Test: `packages/sdk/src/private/schema/preview.spec.ts` (create)
- Create: `packages/sdk/src/private/schema/preview.ts`

- [ ] **Step 1: Write the failing spec**

Create `packages/sdk/src/private/schema/preview.spec.ts`:

```ts
import test from "@rcompat/test";
import { previewSchema } from "#schema/preview";

test.group("preview schema acceptance", () => {
  test.case("parses an empty preview.json", assert => {
    const result = previewSchema.parse({});
    assert(result).equals({});
  });

  test.case("parses variables only", assert => {
    const result = previewSchema.parse({ variables: { componentName: "Button" } });
    assert(result.variables).equals({ componentName: "Button" });
  });

  test.case("parses all fields", assert => {
    const result = previewSchema.parse({
      variables: { theme: "dark" },
      run: "bun run dev",
      output: ".preview",
      watch: true,
    });
    assert(result.variables).equals({ theme: "dark" });
    assert(result.run).equals("bun run dev");
    assert(result.output).equals(".preview");
    assert(result.watch).true();
  });
});

test.group("preview schema rejections", () => {
  test.case("rejects unknown keys", async assert => {
    let threw = false;
    try {
      previewSchema.parse({ variable: "typo" });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("rejects a non-string run", async assert => {
    let threw = false;
    try {
      previewSchema.parse({ run: 42 });
    } catch {
      threw = true;
    }
    assert(threw).true();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd packages/sdk && npx proby src/private/schema/preview.spec.ts`
Expected: FAIL — the import `#schema/preview` cannot be resolved (module not found).

- [ ] **Step 3: Implement the schema**

Create `packages/sdk/src/private/schema/preview.ts`:

```ts
import zod from "zod";

export const previewSchema = zod.object({
  variables: zod.record(zod.string(), zod.string()).optional(),
  run: zod.string().optional(),
  output: zod.string().optional(),
  watch: zod.boolean().optional(),
}).strict();

export type PreviewJsonFile = zod.infer<typeof previewSchema>;

export const previewJsonSchema = () =>
  zod.toJSONSchema(previewSchema, { io: "input" });
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd packages/sdk && npx proby src/private/schema/preview.spec.ts`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/private/schema/preview.ts packages/sdk/src/private/schema/preview.spec.ts
git commit -m "feat(sdk): preview.json zod schema"
```

---

### Task 2: Export the schema from the SDK's index

**Files:**
- Modify: `packages/sdk/src/private/index.ts`

- [ ] **Step 1: Add the export**

In `packages/sdk/src/private/index.ts`, directly below the config export line:

```ts
export { powerupConfigSchema, type PowerupConfig, type PackageEntry } from "#schema/config";
```

insert:

```ts
export { previewSchema, previewJsonSchema, type PreviewJsonFile } from "#schema/preview";
```

(The public entry `packages/sdk/src/public/index.ts` is `export * from "#index"`, so the schema and type surface through the package root export `.` automatically.)

- [ ] **Step 2: Verify type-check and build pass**

Run: `cd packages/sdk && npm run build`
Expected: exit 0, `lib/` regenerated without errors.

- [ ] **Step 3: Verify runtime resolution from source**

Run: `cd packages/sdk && bun --conditions @powerups/source -e "import('#schema/preview').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'previewSchema', 'previewJsonSchema' ]`

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/private/index.ts
git commit -m "feat(sdk): export preview schema from public entry"
```

---

### Task 3: Build script, committed artifact, freshness guard

**Files:**
- Create: `packages/sdk/scripts/build-preview-schema.ts`
- Create: `packages/sdk/preview.schema.json` (generated by the script)
- Modify: `packages/sdk/src/private/schema/preview.spec.ts` (append one case)

- [ ] **Step 1: Write the build script**

Create `packages/sdk/scripts/build-preview-schema.ts`:

```ts
#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { previewJsonSchema } from "#schema/preview";

const outputPath = new URL("../preview.schema.json", import.meta.url);

await writeFile(outputPath, `${JSON.stringify(previewJsonSchema(), null, 2)}\n`);
```

Note: run it with `--conditions @powerups/source` (as in Step 2) — without the flag, bun resolves `#schema/preview` to the built `lib/` instead of `src/`.

- [ ] **Step 2: Generate the artifact**

Run: `cd packages/sdk && bun run --conditions @powerups/source scripts/build-preview-schema.ts`
Expected: exit 0; `packages/sdk/preview.schema.json` created with exactly this content:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "variables": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "run": {
      "type": "string"
    },
    "output": {
      "type": "string"
    },
    "watch": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 3: Verify the file is not gitignored**

Run: `git check-ignore -v packages/sdk/preview.schema.json; echo "exit=$?"`
Expected: no output, `exit=1` (not ignored — it will be committed).

- [ ] **Step 4: Append the freshness guard to the spec**

In `packages/sdk/src/private/schema/preview.spec.ts`, update the import and append one case. The two imports at the top become:

```ts
import test from "@rcompat/test";
import { readFile } from "node:fs/promises";
import { previewSchema, previewJsonSchema } from "#schema/preview";
```

At the end of the file, append:

```ts
test.case("committed preview.schema.json is up to date", async assert => {
  const committed = await readFile(
    new URL("../../../preview.schema.json", import.meta.url),
    "utf8",
  );
  assert(`${JSON.stringify(previewJsonSchema(), null, 2)}\n`).equals(committed);
});
```

(The relative URL is 3 levels up from the spec's own directory: `src/private/schema/` → `packages/sdk/`.)

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd packages/sdk && npx proby src/private/schema/preview.spec.ts`
Expected: PASS — 6 cases, including the freshness guard.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/scripts/build-preview-schema.ts packages/sdk/preview.schema.json packages/sdk/src/private/schema/preview.spec.ts
git commit -m "feat(sdk): preview.schema.json artifact + build script"
```

---

### Task 4: package.json wiring (`schema` script, release chain, `files`)

**Files:**
- Modify: `packages/sdk/package.json`

- [ ] **Step 1: Update `files` and `scripts`**

In `packages/sdk/package.json`, add the artifact to the `files` whitelist and add the `schema` script; replace the `release` line. The two blocks become:

```json
"files": [
  "/lib/**/*.js",
  "/lib/**/*.d.ts",
  "/preview.schema.json",
  "!/**/*.spec.*"
],
```

```json
"scripts": {
  "build": "npm run clean && tsgo",
  "clean": "rm -rf ./lib",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "schema": "bun run --conditions @powerups/source scripts/build-preview-schema.ts",
  "prepublishOnly": "npm run build",
  "test": "npx proby",
  "release": "npm run schema && git add preview.schema.json && commit-and-tag-version --preset conventionalcommits --path . --commit-all",
  "release:dry-run": "commit-and-tag-version --preset conventionalcommits --path . --dry-run"
},
```

Key wiring facts:
- `prepublishOnly` stays `npm run build` — the artifact is committed, so publish needs no generation step.
- `release` regenerates the schema → stages it → commit-and-tag-version runs with `--commit-all` so the release commit includes the artifact (its README-documented pattern). Run `release` from a clean tree.

- [ ] **Step 2: Verify the `schema` npm script works end-to-end**

Run: `cd packages/sdk && npm run schema && git status --short`
Expected: exit 0; `git status` shows no changes (the regenerated file is byte-identical to the committed one).

- [ ] **Step 3: Verify npm pack includes the artifact**

Run: `cd packages/sdk && npm pack --dry-run 2>&1 | grep preview.schema`
Expected: a line listing `preview.schema.json` in the tarball contents.

- [ ] **Step 4: Verify the release chain is accepted by commit-and-tag-version**

Run: `cd packages/sdk && git add preview.schema.json && npx commit-and-tag-version --preset conventionalcommits --path . --commit-all --dry-run`
Expected: dry-run changelog/version output, exit 0, and **no** commit or tag created (`git status --short` still shows nothing for the artifact).

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/package.json
git commit -m "chore(sdk): generate preview schema in release; ship artifact via files"
```

---

### Task 5: CLI imports `PreviewJsonFile` from the SDK

**Files:**
- Modify: `packages/cli/src/private/utils/preview/read-preview-json.ts`

- [ ] **Step 1: Replace the local type with the SDK import**

`packages/cli/src/private/utils/preview/read-preview-json.ts` becomes (the local `PreviewJsonFile` definition is deleted; the re-export keeps the module's public surface unchanged):

```ts
import type { FileRef } from "@rcompat/fs";
import type { PreviewJsonFile } from "@liolocs/powerups-sdk";
import preview_errors from "#errors/previewErrors";
import getErrorMessage from "#errors/get-error-message";

export type { PreviewJsonFile };

export default async function readPreviewJson({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<PreviewJsonFile | undefined> {
  const previewJsonRef = powerupRoot.append("/preview.json");

  if (!(await previewJsonRef.exists())) {
    return undefined;
  }

  try {
    return JSON.parse(await previewJsonRef.text()) as PreviewJsonFile;
  } catch (error) {
    throw preview_errors.preview_json_invalid(getErrorMessage(error));
  }
}
```

- [ ] **Step 2: Verify the CLI builds**

Run: `cd packages/cli && npm run build`
Expected: exit 0 (tsgo type-check + tsup bundle + template copies).

- [ ] **Step 3: Verify CLI tests pass**

Run: `cd packages/cli && npm test`
Expected: PASS — preview-related specs (`resolve-preview-config.spec.ts`, `watch-source.spec.ts`, `previewErrors.spec.ts`) still pass; runtime behavior is unchanged (type-only change).

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/private/utils/preview/read-preview-json.ts
git commit -m "refactor(cli): import PreviewJsonFile type from sdk"
```

---

### Task 6: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Build all packages**

Run (from repo root): `pnpm run build:packages`
Expected: exit 0 for every package.

- [ ] **Step 2: Run both test suites**

Run (from repo root): `npm run test:cli`
Run: `cd packages/sdk && npm test`
Expected: PASS for both.

- [ ] **Step 3: Confirm the working tree is clean**

Run: `git status --short`
Expected: no output (everything committed in Tasks 1–5).

Do **not** run `npm run release` in this sweep — it bumps the version and creates a tag; that belongs to the maintainer's release flow.