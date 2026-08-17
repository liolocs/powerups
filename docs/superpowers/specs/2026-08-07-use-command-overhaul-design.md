# Use Command Overhaul — Design (Incremental Migration revision)

## Overview

Overhaul the `pup use` command to work with the new powerup format (one powerup per package, `package.json["powerup"]` singular, type declared in instructions, built `dist/instructions.json`).

**This is an incremental, human-supervised migration, not a big-bang rewrite.** An incomplete skeleton already exists at `packages/cli/src/private/commands/use/use-new.ts`. Implementation proceeds **one small step at a time**: each step moves one slice of functionality out of the old `packages/cli/src/private/commands/use/index.ts` and into the functions laid out by the `use-new.ts` skeleton (and their supporting utils). The old command keeps working throughout. Only at the very end is the old command deleted and `use-new.ts` promoted to replace it.

**STOP-and-report protocol (binding):** after **every** step in Section 0.3, the agent stops, shows the diff, and reports what changed. The user reviews, runs whatever checks they want, makes their own adjustments to the agent's changes, and reports back. The agent does **not** proceed to the next step until the user confirms. The user may redirect, reorder, or reshape any step based on what they see.

## Current State (already on disk — do not recreate)

| File | Status |
|---|---|
| `packages/cli/src/private/commands/use/use-new.ts` | **Skeleton, incomplete.** Defines the new command with a thin `action` and TODO-commented call sites: `checkForPreUseErrors`, `getPowerup`, `validatePowerup`, `checkForOtherPreFlightErrors`, `runPowerup`. Only `getFlagFromRawFlags` is implemented. Missing `--type` and `--overwrite` flags. Several referenced functions don't exist yet. |
| `packages/cli/src/private/utils/use/run-powerup/index.ts` | Skeleton. Loops steps, calls `runStep`, calls `saveManifest` per step (non-dry-run). No variable resolution, no overwrite support, no skip/no-op handling, no revert-on-failure. |
| `packages/cli/src/private/utils/use/run-powerup/run-step.ts` | Skeleton dispatcher (`stepTypes` map) for create/modify/delete/read/install. Only the install handler exists. Also has a bug (`is.truthy(runStep)` should check `runStepFn`). |
| `packages/cli/src/private/utils/use/run-powerup/steps/run-install-step.ts` (+ spec) | First concrete step handler — pattern to follow for the other four. |
| `packages/cli/src/private/utils/use/run-powerup/save-manifest.ts` (+ spec) | Writes manifest lines. Needs rework for real JSONL append semantics (currently rewrites a JSON array). |
| `packages/sdk/src/private/schema/manifest.ts` | **Created — see Section 2.** Per-step-line zod schema (differs from the earlier entry-based draft; the on-disk schema is authoritative). |
| `packages/cli/src/private/test-utils/create-fully-built-powerup-for-test.ts` | **Created — see Section 1.** Builds a real powerup package via the actual `build` command and returns `{ instructions, packageDir }`. |
| `packages/cli/src/private/commands/use/index.ts` | **Old command — the migration source.** Fully working; keeps working until the final swap. Its inline logic is what gets carved out step by step. |
| `packages/cli/src/commands/use.ts` | Thin re-export of `private/commands/use/index.js`. Only touched at the final swap (if at all — the swap can keep this path stable by replacing `index.ts`). |

## Section 0: Step-by-Step Interactive Migration

### 0.1 Ground rules

1. **One step at a time.** Each step in 0.3 is one atomic, reviewable change (ideally one function's worth). No batching steps without user approval.
2. **Stop and report after every step.** Agent reports: files changed, behavior moved, tests run and their results, any open questions or divergences discovered. Then waits.
3. **The user is an active editor.** The user will make their own changes on top of the agent's output at every step and report back. The agent must re-read the files before continuing — never assume the tree matches what the agent last wrote.
4. **The old command stays green until the swap.** Old specs must keep passing at every step. New code lives in `use-new.ts` and `utils/use/run-powerup/` (or new files alongside) without disturbing `private/commands/use/index.ts` until the final step.
5. **Tests accompany each step**, written in the established style (Section 0.4), run before the agent reports back. A step is not done until its specs are green.
6. **Divergence handling.** When the skeleton, the old code, and this plan disagree, the agent surfaces the disagreement in its report and the user decides. Do not silently pick one.

### 0.2 What the skeleton promises (function-by-function migration map)

The `use-new.ts` `action` is the target shape. Each commented call site absorbs specific behavior from the old `use/index.ts`:

| Skeleton call site | Absorbs from old `use/index.ts` | New home |
|---|---|---|
| (top of action) | `missing_name` and `main_folder_not_found` guards, root resolution | stays inline in `use-new.ts` action |
| flag parsing | dry-run detection (add `--type`, `--overwrite` flags + parsing) | `getFlagFromRawFlags` + flag defs |
| `checkForPreUseErrors(root, rawFlags)` | `verifyGitRepo`, `ensureCleanTree` (skip entirely on dry-run) | `#utils/use/check-pre-use-errors.ts` |
| `getPowerup({ root, name, type })` | new-format resolution: config → `parseSpecifier` → local-then-global store dirs → keyword check → `powerupPropertySchema` → `dist/instructions.json` load + `instructionsSchema` validation → match by `instructions.name` (+`type` filter) → `not_found` / `ambiguous` errors. Also absorbs the old `instructions_not_built` existence check and best-effort version read. | `#utils/use/get-powerup/` (dir with `index.ts` + `load-instructions.ts`) |
| (in action) | `extractVariables` with `EXCLUDE_FLAGS`, `missing_variables` | stays inline in action (existing `#utils/variables`) |
| `validatePowerup(powerup)` | semantic validation beyond schema (shared with `build` later under `#utils/validate/`); initially thin | `#utils/validate/validate-powerup.ts` |
| `checkForOtherPreFlightErrors({ root, powerup })` | (1) `preFlight` destination-exists checks; (2) single-use top-level `already_applied` check; (3) compute steps-to-skip from already-applied included single-use powerups | `#utils/use/check-pre-flight-errors.ts` (reusing/relocating `#utils/pre-flight`) |
| `runPowerup({ destination, powerupDir, instructions, isDryRun })` | step execution with variable resolution (`variableMap`), overwrite handling, skip-already-applied marking, no-op detection, revert-on-failure, per-step manifest recording | `#utils/use/run-powerup/` (exists, needs completion) |

### 0.3 Steps (each ends at a checkpoint)

**Step 0 — already done (user-confirmed).** SDK manifest schema, `create-fully-built-powerup-for-test.ts`, `use-new.ts` skeleton, `run-powerup` skeleton, install-step handler.

**Step 1 — Skeleton gap-fill.** Add `--type`/`--overwrite` flag definitions to `use-new.ts`; create stub or minimal files for every referenced-but-missing function so `use-new.ts` typechecks. Fix the `runStep` truthiness bug. *Report + wait.*

**Step 2 — Variable extraction.** Wire `extractVariables` into the action (required/optional/defaults/`missing_variables`), passing results through `runPowerup` to the step handlers. *Report + wait.*

**Step 3 — `checkForPreUseErrors`.** New `#utils/use/check-pre-use-errors.ts`: `verifyGitRepo` + `ensureCleanTree`, skipped when dry-run. Spec with `create-project-for-test` (see Section 1; build fixture first if user hasn't added it). *Report + wait.*

**Step 4 — `getPowerup` (resolver).** `#utils/use/get-powerup/` implementing Section 3's flow; returns `{ instructions, folder (dist), packageDir, packageName, location, version }`. Add `ambiguous` to `useErrors`. Specs with `create-fully-built-powerup-for-test`. *Report + wait.*

**Step 5 — `validatePowerup`.** Initially a thin schema-validation pass placed at `#utils/validate/` so `build` can reuse it later; exact scope decided with the user at this checkpoint. *Report + wait.*

**Step 6 — `checkForOtherPreFlightErrors`.** Relocate/update `preFlight` for create-destination checks; add single-use top-level check and compute `{ effectiveSteps, skippedSteps, fromInfo }`-equivalent data for `runPowerup` (naming aligned to the new line-based manifest at this checkpoint). *Report + wait.*

**Step 7 — Step handlers, one at a time (each its own checkpoint).** Port from old `execute-steps.ts` into `utils/use/run-powerup/steps/`, returning a manifest line per the SDK schema: 7a `run-create-step` (incl. overwrite), 7b `run-modify-step`, 7c `run-delete-step`, 7d `run-read-step` (variable assignment incl. `variableMap` composition). Reuse the existing `run-install-step.ts` as the style template. *Report + wait after each.*

**Step 8 — `runPowerup` orchestration.** Skip-already-applied marking, no-op detection (`Nothing to do` message), revert-on-failure on the recorded files, correct dry-run flow (no git checks, no manifest writes). *Report + wait.*

**Step 9 — `save-manifest` rework.** True JSONL append (one line per step), populate `commit` (nullable) and the discriminated `output` union per the SDK schema. Provide the read side needed by the already-applied checks. *Report + wait.*

**Step 10 — Integration spec.** `use.spec.ts` driving `use.run(...)` end-to-end with `create-fully-built-powerup-for-test`: happy path, dry-run, missing name, missing CLI folder, not_found, already_applied. Compare behavior side-by-side with the old command's specs. *Report + wait.*

**Step 11 — The swap.** Copy the finalized `use-new.ts` over `private/commands/use/index.ts` (keeping the export shape so `commands/use.ts` is untouched), delete `use-new.ts`, delete `utils/execute-steps.ts` and other superseded old utils. Full suite green. *Report + wait.*

**Step 12 — Final cleanup.** Delete old commands (`add`, `find`, `pack`, `install`, `list`, `metrics`) and their utils/errors/constants per Section 5; `knip` sweep; full suite green. *Report + done.*

### 0.4 Testing style (unchanged from established pattern)

- Specs colocated as `*.spec.ts`, using the extended runner `#test-utils/test/index` → `test.case(...)`, `await assert(x).throwsAsync(UseErrorCode.<code>)`, `await assert(x).noErrorAsync()`.
- Real filesystem fixtures in `<projectRoot>/tmp` with `setupTestDir`/`cleanup` — no mocks.
- Fixtures: `create-fully-built-powerup-for-test.ts` (exists, Section 1) for the producer side; `create-project-for-test.ts` (consumer project root with config + manifest + optional git init) — **confirm with user whether it already exists before creating it.**

## Section 1: Test Infrastructure

| File | Status | Purpose |
|---|---|---|
| `create-fully-built-powerup-for-test.ts` | **Exists** | Creates a real powerup package under `<root>/.powerups/_internal/<name>/` and builds it with the actual `build` command → real `dist/instructions.json` + templates. Returns `{ instructions, packageDir }`. Default instructions take a required `name` variable and one `create` step; callers pass custom `Instructions` to exercise other step types. |
| `create-project-for-test.ts` | **To confirm/create at Step 3** | Consumer project root: `.powerups/config.json` with `packages` entries, seeded `.powerups/manifest.jsonl`, optional `git init` (needed for git-guard specs). |

## Section 2: SDK Manifest Schema (as created — authoritative)

`packages/sdk/src/private/schema/manifest.ts` **already exists** and defines a **per-step line** model (supersedes the earlier aggregated-entry draft in this document's history):

- `manifestLineSchema`: `{ powerupName, version, location, type, timestamp, stepName, stepType, status, output, from?, commit }`
- `stepOutputSchema`: discriminated union over `create | modify | delete | install | read | none` — create/modify carry `path`, `action`, `characterCount`; install carries dependency arrays; read carries `variable`; delete carries `path`.
- `manifestSchema = zod.array(manifestLineSchema)` — a manifest file is an array of lines stored as JSONL (`manifest.jsonl`, one JSON object per line).
- Exported types: `StepOutput`, `ManifestEntry` (= one line), `ManifestFile` (= array of lines).

Consequences for the CLI (folded into Steps 6/8/9):

- The old `utils/manifest.ts` (`readManifest` / `appendManifestEntry` / `hasBeenApplied`, aggregated entries) is **reworked or replaced** by the line-based model: `save-manifest.ts` writes lines; the already-applied checks read lines and match on `powerupName` (+ `type` for single-use blocking).
- Included single-use powerups still get their own lines (`from`-grouped) so standalone reuse is blocked later — re-express this against the line schema at the Step 6/8 checkpoints with the user.
- `revert.ts` consumes the recorded file list produced during a run; shape aligned at Step 8.

## Section 3: New-Format Resolver (`getPowerup`)

Implemented at Step 4. Resolution flow:

1. Read project config → `packages` array (existing `readConfig`), falling back to the global config for global resolution.
2. For each entry, `parseSpecifier` → store path (bare names → `_internal/<name>`, `npm:` → npm store, URLs → git store).
3. Check local dir (`root/.powerups/<storePath>`) **first**, then global (`~/.powerups/<storePath>`).
4. Per package dir: `keywords` includes `powerups-package`; `package.json["powerup"]` passes SDK `powerupPropertySchema`; `dist/instructions.json` exists (else `use_errors.instructions_not_built`) and passes `instructionsSchema`; `instructions.name` matches the requested name (and `instructions.type` matches `--type` when given).
5. Local wins on collision. Zero matches → `not_found`; multiple local matches → new `use_errors.ambiguous`.

Return value bundles everything downstream steps need (instructions, dist folder, package dir, packageName, location, best-effort version) so nothing downstream re-reads `package.json` or `instructions.json`.

## Section 4: Step Execution (`runPowerup` / `runStep` / `steps/*`)

The skeleton's dispatch-map style (`stepTypes` in `run-step.ts`) is kept — it matches the per-handler decomposition the old `execute-steps.ts` switch needed anyway:

- `steps/run-create-step.ts` — template render, dry-run print, destination-exists guard, `--overwrite`, manifest line with `create` output.
- `steps/run-modify-step.ts` — `applyMultipleModifications`, dry-run print, warning-on-failure → `skipped-warning` line.
- `steps/run-delete-step.ts` — existence check, remove, dry-run print.
- `steps/run-read-step.ts` — file read, optional template transform, JSON-path extraction, assign into the shared variables map (requires variables threading from Step 2).
- `steps/run-install-step.ts` — **exists**; dependency merge, lock-file detection, dry-run print.

`runPowerup` (Step 8) owns: the loop, skip marking (`skipped-already-applied`), no-op detection, failure → `revertChanges`, and calls `saveManifest` per completed step (non-dry-run only).

## Section 5: Deletion Scope (Step 12 — after the swap)

### Commands deleted

Both `commands/*.ts` and `private/commands/*/`: `add`, `find`, `pack`, `install`, `list`, `metrics`.

### Utils deleted

- `utils/execute-steps.ts` (+ spec) — superseded by `run-powerup/steps/*` (deleted at Step 11)
- `utils/move/` (entire directory — only used by `pack`)
- `utils/resolve-powerup.ts` (+ spec) — superseded by `get-powerup`
- `utils/metrics.ts` (+ spec) — metrics logging removed from `use`
- `utils/project-path.ts` (+ spec) — only used by `metrics`
- `utils/install-package.ts` — only used by `install`
- `utils/dependencies.ts`, `utils/score-intent.ts`, `utils/tokenize.ts` — delete if orphaned
- `utils/manifest.ts` — reworked or deleted at Steps 6/9 depending on the line-model decision
- Old `utils/pre-flight.ts` / `utils/revert.ts` originals — after relocation into `utils/use/`

### Schemas / errors / constants

- Deleted: `schemas/package.ts` (+ spec); `addErrors.ts`, `findErrors.ts`, `packErrors.ts`, `installErrors.ts`, `listErrors.ts`, `powerErrors.ts`, `moveErrors.ts`, `validateErrors.ts`
- `useErrors.ts`: **add `ambiguous`** (Step 4); keep all existing codes
- Constants deleted from `constants.ts`: `powerupsFolderMap`, `METRICS_FILE_NAME`, `NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP`
- Kept: `MULTI_USE_FOLDER`, `SINGLE_USE_FOLDER` (doctor/scaffold), `PowerUpType`, `applied-manifest.ts` + `schemas/applied.ts` (doctor), `parse-specifier.ts`, `config.ts`

### Surviving command set

`build`, `create`, `doctor`, `project`, `update`, `use`

### Final verification

Full test suite green + `knip` clean after Step 12.

## File Map Summary

### SDK package (`packages/sdk/`)

| Action | File | Step |
|---|---|---|
| **Done** | `src/private/schema/manifest.ts` | 0 |
| Spec (if not present) | `src/private/schema/manifest.spec.ts` | 2 (confirm with user) |
| Export check | `src/private/index.ts` | 2 |

### CLI package (`packages/cli/`)

| Action | File | Step |
|---|---|---|
| **Done (skeleton)** | `src/private/commands/use/use-new.ts` | 0 |
| **Done (fixture)** | `src/private/test-utils/create-fully-built-powerup-for-test.ts` | 0 |
| **Done (skeleton)** | `src/private/utils/use/run-powerup/{index,run-step,save-manifest}.ts`, `steps/run-install-step.ts` | 0 |
| Gap-fill | `use-new.ts` flags + missing stubs | 1 |
| New/confirm | `src/private/test-utils/create-project-for-test.ts` | 3 |
| New | `src/private/utils/use/check-pre-use-errors.ts` + spec | 3 |
| New | `src/private/utils/use/get-powerup/` + specs | 4 |
| Modified | `src/private/errors/useErrors.ts` (`ambiguous`) | 4 |
| New | `src/private/utils/validate/validate-powerup.ts` + spec | 5 |
| New/moved | `src/private/utils/use/check-pre-flight-errors.ts` + spec (from `pre-flight`) | 6 |
| New | `steps/run-create-step.ts` + spec | 7a |
| New | `steps/run-modify-step.ts` + spec | 7b |
| New | `steps/run-delete-step.ts` + spec | 7c |
| New | `steps/run-read-step.ts` + spec | 7d |
| Completed | `run-powerup/index.ts` orchestration + spec | 8 |
| Reworked | `run-powerup/save-manifest.ts` + read side | 9 |
| New | `src/private/commands/use/use.spec.ts` (integration) | 10 |
| Swap | `use-new.ts` → `private/commands/use/index.ts`; delete `use-new.ts`, `execute-steps.ts` | 11 |
| Deleted | old commands/utils/errors/constants (Section 5) | 12 |
