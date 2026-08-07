# Use Command Overhaul — Design

## Overview

Overhaul the `pup use` command to work with the new powerup format (one powerup per package, `package.json["powerup"]` singular, type declared in instructions, built `dist/instructions.json`). Follow the same decomposed coding style as the `build` command refactor: thin command action calling focused utility functions, each in its own file under `utils/use/`.

Remove metrics logging from `use`. Move the manifest schema to the SDK package using zod. Delete the old-format commands (`add`, `find`, `pack`, `install`, `list`, `metrics`) and their associated utilities, errors, and constants.

## Background

### New powerup format

Observable in `.powerups/_internal/` powerups and the refactored `build` command:

- One powerup per package
- `package.json` has `"powerup": { "instructions": "index.ts", "compatibility": {} }` (singular), validated by the SDK's `powerupPropertySchema`
- `keywords: ["powerups-package"]` identifies a powerups package
- Powerup type (`"multi-use"` | `"single-use"`) is declared inside the instructions, not derived from folder structure
- Built output: `dist/instructions.json` (schema-validated) + `dist/templates/...`
- Powerups are defined with `defineInstructions(instructions, import.meta.url)` and composed with `includePowerup()`

### Old format (being replaced)

- `package.json["powerups"]` (plural) with `active: { "multi-use": {name: path}, "single-use": {name: path} }` subfolder maps
- Powerups in `multi-use/` / `single-use/` subfolders
- Validated by CLI-local `#schemas/package.ts` (pema)
- Resolved by `resolve-powerup.ts` searching subfolder maps

### Build refactor pattern (coding style to follow)

- Thin command action in `private/commands/<cmd>/index.ts` — just calls utility functions in sequence
- Each utility in its own file under `utils/<cmd>/`, single responsibility
- Helper functions colocated below the main exported function
- Multi-parameter functions take typed object parameters
- Descriptive variable names, proper spacing, self-documenting code (no numbered comments)
- Spec file for every utility

## Section 1: Deletion Scope

### Commands deleted

Both `commands/*.ts` and `private/commands/*/`:

- `add`, `find`, `pack`, `install`, `list`, `metrics`

### Utils deleted

- `utils/move/` (entire directory — only used by `pack`)
- `utils/resolve-powerup.ts` (+ spec) — replaced by new-format resolver
- `utils/metrics.ts` (+ spec)
- `utils/project-path.ts` (+ spec) — only used by `metrics`
- `utils/install-package.ts` — only used by `install`
- `utils/dependencies.ts` (+ spec) — delete if orphaned after removing `install`
- `utils/score-intent.ts`, `utils/tokenize.ts` — delete if orphaned after removing `find`/`list`

### Schemas deleted

- `schemas/package.ts` (+ spec) — old format, all consumers deleted or overhauled

### Errors deleted

- `addErrors.ts`, `findErrors.ts`, `packErrors.ts`, `installErrors.ts`, `listErrors.ts` — commands deleted
- `powerErrors.ts` — old resolver deleted
- `moveErrors.ts` — orphaned
- `validateErrors.ts` — orphaned

### Untouched

- `applied-manifest.ts` + `schemas/applied.ts` — stays for `doctor` (removed when `doctor` is migrated later)
- `manifest.ts` — retired to use SDK schema (Section 2)
- `parse-specifier.ts` (+ spec) — kept; new resolver uses it to resolve config entries to store paths
- `config.ts` (+ spec) — kept; still needed to read config packages

### Surviving command set

`build`, `create`, `doctor`, `project`, `update`, `use`

## Section 2: SDK Manifest Schema

New file: `packages/sdk/src/private/schema/manifest.ts` — zod, following the `instructions.ts` pattern.

```ts
import zod from "zod";

const manifestFileActionSchema = zod.enum(["create", "modify", "delete"]);

const manifestFileSchema = zod.object({
  path: zod.string(),
  action: manifestFileActionSchema,
});

const manifestStepStatusSchema = zod.enum([
  "applied",
  "skipped-warning",
  "skipped-already-applied",
]);

const manifestStepSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  status: manifestStepStatusSchema,
  from: zod.string().optional(),
});

const manifestEntrySchema = zod.object({
  powerup: zod.string(),
  package: zod.string(),
  version: zod.string(),
  location: zod.enum(["local", "global"]),
  type: zod.enum(["multi-use", "single-use"]),
  timestamp: zod.string(),
  variables: zod.record(zod.string(), zod.string()),
  steps: zod.array(manifestStepSchema),
  files: zod.array(manifestFileSchema),
});

export type ManifestEntry = zod.infer<typeof manifestEntrySchema>;
export type ManifestFile = zod.infer<typeof manifestFileSchema>;
export type ManifestStep = zod.infer<typeof manifestStepSchema>;
```

Exported from `packages/sdk/src/private/index.ts`:

```ts
export { manifestEntrySchema, type ManifestEntry, type ManifestFile, type ManifestStep } from "#schema/manifest";
```

CLI's `manifest.ts` stays at `utils/manifest.ts` (schema-backed I/O module, not use-specific orchestration). It drops its hand-written `ManifestEntry` interface and imports the types from `@liolocs/powerups-sdk`. Its functions (`readManifest`, `appendManifestEntry`, `hasBeenApplied`) and JSONL storage format (`manifest.jsonl`) stay the same — only the types come from the SDK now.

`revert.ts` imports `ManifestFile` from the SDK (through `manifest.ts` re-export or directly) instead of `ManifestEntry["files"]`.

## Section 3: New-Format Resolver

New file: `utils/use/resolve-powerup.ts` — replaces the old `utils/resolve-powerup.ts`.

### Resolution flow

1. Read project config → `packages` array (via existing `readConfig`)
2. For each package entry, `parseSpecifier` → `storePath` (same mechanism: bare names → `_internal/<name>`, `npm:` → npm store, URLs → git store)
3. Resolve to local dir (`root/.powerups/<storePath>`) first, then global (`~/.powerups/<storePath>`)
4. For each resolved package dir:
   - Read `package.json`, check `keywords` includes `powerups-package`
   - Parse `package.json["powerup"]` via SDK's `powerupPropertySchema`
   - Read `dist/instructions.json` → parse via `instructionsSchema` (via `load-instructions.ts`)
   - If `instructions.name` matches the requested name (and `instructions.type` matches if `--type` flag given) → match
5. Return the match, preferring local on collision. Throw `not_found` if zero matches, `ambiguous` if multiple local matches.

### Return type

```ts
interface ResolvedPowerUp {
  folder: FileRef;            // the dist/ dir (instructions.json + templates live here)
  packageName: string;
  location: "local" | "global";
  instructions: Instructions; // parsed from dist/instructions.json
}
```

The resolver returns the parsed `instructions` directly — it already reads `dist/instructions.json` to match by name, so there's no re-read in the command action. The `--type` flag is kept for disambiguation (filters matches by `instructions.type`).

### Helper

`utils/use/load-instructions.ts` — reads + schema-validates `dist/instructions.json` from a given folder. Called by the resolver; kept separate for testability.

`parse-specifier.ts` and `config.ts` stay at `utils/` level — shared infrastructure, not use-specific.

## Section 4: Use Command Decomposition

`use/index.ts` becomes a thin action — just orchestration, like `build/index.ts`:

```ts
action: async ({ subcommands, rawFlags, flags, context }) => {
  const name = getName(subcommands);
  const root = await getRoot(context);
  await ensureMainFolder(root);

  const resolved = await resolvePowerUp({ root, name, typeFlag: flags.type });
  const variables = extractVariables({ rawFlags, ...resolved.instructions.variables, excludeFlags, onMissing });
  const { effectiveSteps, skippedSteps, fromInfo } = await checkAlreadyApplied({ root, instructions: resolved.instructions });
  const meta = await getPackageMeta({ resolved, variables });

  const record = await runSteps({
    steps: effectiveSteps,
    skippedSteps,
    variables,
    outputFolder: resolved.folder,
    rootDir: root,
    isDryRun,
    isOverwrite,
  });

  if (isNoOp(record)) {
    cli.print(`Nothing to do — all steps already applied or skipped.\n`);
    return;
  }

  await recordManifest({ root, instructions: resolved.instructions, record, meta, fromInfo });
}
```

### New files under `utils/use/`

| File | Responsibility |
|---|---|
| `resolve-powerup.ts` | New-format resolver (Section 3) |
| `load-instructions.ts` | Read + schema-validate `dist/instructions.json` |
| `check-already-applied.ts` | Single-use top-level check + skip steps from already-applied included single-use powerups; returns `{ effectiveSteps, skippedSteps, fromInfo }` |
| `get-package-meta.ts` | Best-effort read of package version from `package.json`; returns `PackageMeta` and exports the type. `PackageMeta = { packageName: string; version: string; location: "local" \| "global"; variables: Record<string, string> }` |
| `run-steps.ts` | Orchestrates execution — dry-run path (just `executeSteps` + record skipped) vs non-dry-run path (git verify, clean tree, pre-flight, `executeSteps` with revert on failure, record skipped). Returns `RunRecord`. Also exports `isNoOp`. |
| `record-manifest.ts` | Builds parent manifest entry + per-included-powerup entries, appends them via `manifest.ts` |

### Moved from `utils/` into `utils/use/`

- `execute-steps.ts` (+ spec) — decomposed further (Section 5)
- `pre-flight.ts` (+ spec) — updated for clean coding principles (object params, spacing, descriptive names, self-documenting)
- `revert.ts` (+ spec)

### Stays at `utils/` level (shared infrastructure)

- `variables.ts` — `toKebabCase` used by `useErrors.ts`
- `git.ts`, `config.ts`, `parse-specifier.ts`, `manifest.ts`
- Template/output utilities (`resolve-template-string.ts`, `modify-engine.ts`, etc.)

### Spec files

Every new file gets a spec file. Existing spec files move with their source. New specs: `resolve-powerup.spec.ts`, `load-instructions.spec.ts`, `check-already-applied.spec.ts`, `get-package-meta.spec.ts`, `run-steps.spec.ts`, `record-manifest.spec.ts`, plus decomposed step handler specs (Section 5).

## Section 5: execute-steps Decomposition

The current `execute-steps.ts` is one large function with a `switch` over five step types. Decompose into an orchestrator + per-step-type handlers.

### Orchestrator: `utils/use/execute-steps.ts`

Keeps the loop, step-variable resolution, `from` tracking, and `RunRecord` type. Dispatches to the appropriate handler:

```ts
export async function executeSteps({
  steps,
  variables,
  outputFolder,
  rootDir,
  isDryRun,
  isOverwrite,
  record,
}: ExecuteStepsArgs): Promise<void> {
  for (const step of steps) {
    const stepVars = resolveStepVariables(step, variables);
    const from = fromOf(step);

    switch (step.type) {
      case "read":    await runRead({ step, stepVars, outputFolder, rootDir, isDryRun, record }); break;
      case "create":  await runCreate({ step, stepVars, outputFolder, rootDir, isDryRun, isOverwrite, record }); break;
      case "modify":  await runModify({ step, stepVars, outputFolder, rootDir, isDryRun, record }); break;
      case "delete":  await runDelete({ step, stepVars, rootDir, isDryRun, record }); break;
      case "install": await runInstall({ step, stepVars, rootDir, isDryRun, record }); break;
    }
  }
}
```

Stays in the orchestrator:
- `RunRecord` interface + `ExecuteStepsArgs` interface
- `resolveStepVariables` — applies `variableMap` composition before dispatching
- `fromOf` — extracts `from.name` for step record tracking

### Per-step handlers under `utils/use/steps/`

| File | Extracted logic | Private helpers that move with it |
|---|---|---|
| `run-read.ts` | Read step: file read, optional template transform, JSON path extraction, `variables[as]` assignment | `navigateJsonPath` |
| `run-create.ts` | Create step: template render, dry-run print, destination-exists check, write | — |
| `run-modify.ts` | Modify step: dry-run print, `applyMultipleModifications`, write, warning-on-failure | — |
| `run-delete.ts` | Delete step: dry-run print, existence check, remove | — |
| `run-install.ts` | Install step: dependency merge into `package.json`, lock-file detection, package manager run | `parseDepName`, `depVersion`, `LOCK_FILES` |
| `index.ts` | Barrel re-exporting all handlers | — |

### Handler signature

Uniform across all five — each handler gets only the params it actually uses:

```ts
export async function runCreate({
  step,
  stepVars,
  outputFolder,
  rootDir,
  isDryRun,
  isOverwrite,
  record,
}: {
  step: Extract<Step, { type: "create" }>;
  stepVars: VariableResult;
  outputFolder: FileRef;
  rootDir: FileRef;
  isDryRun: boolean;
  isOverwrite: boolean;
  record: RunRecord;
}): Promise<void>
```

`run-read` and `run-delete` don't need `isOverwrite`. `run-install` doesn't need `outputFolder` or `isOverwrite`. Each handler pushes to `record.steps` and `record.files` internally.

### Spec files

- `execute-steps.spec.ts` moves and tests the orchestrator dispatch + `resolveStepVariables`
- `run-read.spec.ts`, `run-create.spec.ts`, `run-modify.spec.ts`, `run-delete.spec.ts`, `run-install.spec.ts` — each tests its handler in isolation

## Section 6: Manifest Recording

New file: `utils/use/record-manifest.ts`

Extracts the manifest-entry building logic currently inline in `use/index.ts`.

### `buildManifestEntry`

Builds the parent entry from the instructions + run record + meta:

```ts
function buildManifestEntry({
  instructions,
  record,
  meta,
}: {
  instructions: Instructions;
  record: RunRecord;
  meta: PackageMeta;
}): ManifestEntry {
  return {
    powerup: instructions.name,
    package: meta.packageName,
    version: meta.version,
    location: meta.location,
    type: instructions.type,
    timestamp: new Date().toISOString(),
    variables: meta.variables,
    steps: record.steps,
    files: record.files,
  };
}
```

### `includedPowerupEntries`

Builds one entry per included powerup, grouped by `from.name` among applied steps. Preserves the current behavior: an included single-use powerup gets its own manifest entry so it's blocked if someone tries to apply it standalone later.

### `recordManifest`

The exported orchestrator:

```ts
export async function recordManifest({
  root,
  instructions,
  record,
  meta,
  fromInfo,
}: { ... }): Promise<void> {
  await appendManifestEntry(root, buildManifestEntry({ instructions, record, meta }));
  for (const entry of includedPowerupEntries({ record, fromInfo, meta })) {
    await appendManifestEntry(root, entry);
  }
}
```

### `fromInfo`

The `Map<string, { name: string; singleUse: boolean }>` is built in `check-already-applied.ts` (iterates steps to extract `from` fields) and returned as part of its result. The `FromInfo` type is exported from `check-already-applied.ts` and consumed by `record-manifest.ts`.

### No metrics logging

The `logRun` call is removed entirely. `utils/metrics.ts` is deleted (Section 1).

## Section 7: Error & Constant Cleanup

### Error files deleted

| File | Reason |
|---|---|
| `addErrors.ts` | `add` command deleted |
| `findErrors.ts` | `find` command deleted |
| `packErrors.ts` | `pack` command deleted |
| `installErrors.ts` | `install` command deleted |
| `listErrors.ts` | `list` command deleted |
| `powerErrors.ts` | old `resolve-powerup.ts` deleted |
| `moveErrors.ts` | orphaned (move utils deleted) |
| `validateErrors.ts` | orphaned (no usage found) |

### Error files kept (unchanged)

`buildErrors.ts`, `createErrors.ts`, `doctorErrors.ts`, `appliedErrors.ts`, `projectErrors.ts`, `runnerErrors.ts`, `updateErrors.ts`, `initErrors.ts`

### `useErrors.ts` updated

- Add `ambiguous` (migrated from `powerErrors` — the new resolver throws it on multiple local matches)
- All existing error codes stay (`not_found`, `already_applied`, `template_not_found`, `destination_file_exists`, git errors, modify errors, read errors, etc.)
- `instructions_not_built` stays — still relevant when `dist/instructions.json` is missing

### Constants deleted from `constants.ts`

| Constant | Reason |
|---|---|
| `powerupsFolderMap` | no usage outside constants |
| `METRICS_FILE_NAME` | only used by `metrics.ts` (deleted) |
| `NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP` | only used by `install-package.ts` (deleted) |

### Constants kept

- `MULTI_USE_FOLDER`, `SINGLE_USE_FOLDER` — still used by `doctor` + `scaffold` (project init)
- `PowerUpType` — used by `create` command + new `use` resolver (`--type` flag)
- All others unchanged

### Final verification

After all deletions, run `knip` to catch any remaining orphaned files or exports.

## File Map Summary

### SDK package (`packages/sdk/`)

| Action | File |
|---|---|
| New | `src/private/schema/manifest.ts` |
| Modified | `src/private/index.ts` (add manifest exports) |
| New | `src/private/schema/manifest.spec.ts` |

### CLI package (`packages/cli/`)

| Action | File |
|---|---|
| Modified | `src/commands/index.ts` (remove deleted commands) |
| Rewritten | `src/private/commands/use/index.ts` (thin action) |
| New | `src/private/utils/use/resolve-powerup.ts` + spec |
| New | `src/private/utils/use/load-instructions.ts` + spec |
| New | `src/private/utils/use/check-already-applied.ts` + spec |
| New | `src/private/utils/use/get-package-meta.ts` + spec |
| New | `src/private/utils/use/run-steps.ts` + spec |
| New | `src/private/utils/use/record-manifest.ts` + spec |
| Moved + decomposed | `src/private/utils/use/execute-steps.ts` + spec |
| New | `src/private/utils/use/steps/run-read.ts` + spec |
| New | `src/private/utils/use/steps/run-create.ts` + spec |
| New | `src/private/utils/use/steps/run-modify.ts` + spec |
| New | `src/private/utils/use/steps/run-delete.ts` + spec |
| New | `src/private/utils/use/steps/run-install.ts` + spec |
| New | `src/private/utils/use/steps/index.ts` |
| Moved + updated | `src/private/utils/use/pre-flight.ts` + spec |
| Moved | `src/private/utils/use/revert.ts` + spec |
| Modified | `src/private/utils/manifest.ts` (import types from SDK) |
| Modified | `src/private/errors/useErrors.ts` (add `ambiguous`) |
| Modified | `src/private/constants.ts` (delete 3 constants) |
| Deleted | `src/commands/{add,find,pack,install,list,metrics}.ts` |
| Deleted | `src/private/commands/{add,find,pack,install,list,metrics}/` |
| Deleted | `src/private/utils/{move/,resolve-powerup,metrics,project-path,install-package}.ts` + specs |
| Deleted | `src/private/utils/{dependencies,score-intent,tokenize}.ts` + specs (if orphaned) |
| Deleted | `src/private/schemas/package.ts` + spec |
| Deleted | `src/private/errors/{add,find,pack,install,list,power,move,validate}Errors.ts` |