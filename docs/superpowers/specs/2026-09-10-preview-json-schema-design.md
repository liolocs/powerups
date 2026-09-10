# Published `preview.schema.json` — Design

## 1. Overview

Powerup authors hand-write a `preview.json` in their powerup root with no validation
and no editor support. The CLI reads it with a bare `JSON.parse(...) as PreviewJsonFile`
cast, and the shape is defined only inside the CLI
(`packages/cli/src/private/utils/preview/read-preview-json.ts`).

Goal: publish a `preview.schema.json` with `@liolocs/powerups-sdk` on npm so external
tooling and editors can validate `preview.json` against a stable, versioned schema.

The SDK becomes the source of truth for the shape: a zod schema lives next to the other
schemas (`src/private/schema/`), and a build script emits the JSON Schema artifact that is
committed at the SDK package root and shipped in the npm tarball.

**Confirmed shape** (from `read-preview-json.ts` — the only definition in the repo):

```ts
export type PreviewJsonFile = {
  variables?: Record<string, string>;
  run?: string;
  output?: string;
  watch?: boolean;
};
```

## 2. Decisions from brainstorming

| Decision | Choice |
|---|---|
| Schema strictness | `.strict()` — emits `additionalProperties: false`; editors flag unknown keys (accepted trade-off) |
| CLI type definition | Deleted; `read-preview-json.ts` imports the type from `@liolocs/powerups-sdk` (existing convention in the CLI) |
| Artifact location | `packages/sdk/preview.schema.json`, committed to the repo (not gitignored) |
| When the artifact is generated | `release` script, before the changelog step — not at publish time. No `publish` script (a `publish` lifecycle script runs after the tarball is already uploaded; it could never include the file) |
| JSON Schema converter | zod 4's built-in `z.toJSONSchema()` — verified working against the installed zod; no new dependency |
| Script runtime | Bun (`bun run scripts/*.ts` is the repo convention), with `--conditions @powerups/source` so internal `#schema/*` imports resolve to `src/` instead of a stale `lib/` |

## 3. Schema — `packages/sdk/src/private/schema/preview.ts`

Follows the existing schema-file pattern (`config.ts`, `manifest.ts`, …):

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

- `PreviewJsonFile` keeps the CLI's type name for continuity.
- The generator function lives beside the schema so the script and the spec share one
  emission path (no duplicated conversion logic).
- Verified output (draft 2020-12, `io: "input"`):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "variables": {
      "type": "object",
      "propertyNames": { "type": "string" },
      "additionalProperties": { "type": "string" }
    },
    "run":    { "type": "string" },
    "output": { "type": "string" },
    "watch":  { "type": "boolean" }
  },
  "additionalProperties": false
}
```

Exported from `packages/sdk/src/private/index.ts` (schema + type), which surfaces it
through the public entry (`src/public/index.ts` → `export * from "#index"`), exactly like
the other schemas.

## 4. Build script — `packages/sdk/scripts/build-preview-schema.ts`

- Bun script (shebang `#!/usr/bin/env bun`), imports `{ previewJsonSchema }` from
  `#schema/preview` and writes `packages/sdk/preview.schema.json`
  (`JSON.stringify(schema, null, 2) + "\n"`).
- `#schema/preview` resolves:
  - under `tsgo` type-checking → `src/private/schema/preview.ts` (root tsconfig
    `customConditions: ["@powerups/source"]`; root tsconfig already includes
    `${configDir}/scripts`);
  - at runtime → the npm script passes `--conditions @powerups/source` (verified: plain
    `bun run` resolves the default condition to the built `lib/`, which could be stale;
    with the flag it resolves to `src/`).
- Non-zero exit on write failure.

## 5. package.json wiring (`packages/sdk`)

```json
"files": [
  "/lib/**/*.js",
  "/lib/**/*.d.ts",
  "/preview.schema.json",
  "!/**/*.spec.*"
],
"scripts": {
  "schema": "bun run --conditions @powerups/source scripts/build-preview-schema.ts",
  "release": "npm run schema && git add preview.schema.json && commit-and-tag-version --preset conventionalcommits --path . --commit-all",
  ...
}
```

- `prepublishOnly` is unchanged (`npm run build`) — the artifact is already committed, so
  publish needs no generation step. `"/preview.schema.json"` added to `files` puts it in
  the tarball (the whitelist otherwise only covers `/lib`).
- Release order: regenerate schema → stage it → commit-and-tag-version with `--commit-all`
  so the release commit includes the artifact (README-documented pattern: stage the
  artifacts you want committed). Caveat: run `release` from a clean tree, since
  `--commit-all` commits staged/modified files; the artifact changes only when the schema
  changes, so in practice the tree is clean after feature work is committed. Behavior is
  verified with a `release:dry-run` during implementation.
- `git check-ignore` confirmed `packages/sdk/preview.schema.json` is not ignored by any
  gitignore — no ignore-file changes needed.

## 6. CLI consumes the SDK type — `packages/cli/src/private/utils/preview/read-preview-json.ts`

```ts
import type { PreviewJsonFile } from "@liolocs/powerups-sdk";
```

Local type definition deleted; runtime behavior unchanged (still a plain cast, no
validation — wiring runtime validation is out of scope). The CLI already has the SDK as a
devDependency and imports types from it in ~15 files, so this follows the established
pattern. The published CLI ships only `lib/bin.js` (tsup bundle), so a type-only import
adds no runtime dependency.

## 7. Spec — `packages/sdk/src/private/schema/preview.spec.ts`

Under the existing proby setup, mirroring sibling specs (`instructions.spec.ts`):

1. `previewSchema.parse` accepts the documented shapes: `{}`, `variables`-only, all four
   fields, `run` overrides.
2. `.strict()` rejects unknown keys.
3. Freshness guard: `previewJsonSchema()` output equals the committed
   `packages/sdk/preview.schema.json` — fails CI if the schema changes without
   regenerating the artifact.

## 8. Verification

1. `cd packages/sdk && npm run schema` → `preview.schema.json` written, contents match §3.
2. `npm test` (proby) passes, including the freshness guard.
3. `npm run build` passes (type-check includes the new schema, script, and CLI change).
4. `npm pack --dry-run` lists `preview.schema.json` in the tarball.
5. `release:dry-run` confirms commit-and-tag-version picks up the staged artifact.

## 9. Out of scope

- Runtime validation of `preview.json` in the CLI (replacing the `as` cast with the zod
  schema) — separate follow-up if desired.
- Regenerating schemas for instructions/manifest/config — same pattern applies later.