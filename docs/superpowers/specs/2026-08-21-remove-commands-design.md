# Design: Remove 7 CLI commands and their fallout

**Date:** 2026-08-21
**Package:** `@liolocs/powerups-cli` (`packages/cli`)

## Goal

Remove seven CLI commands — `add`, `find`, `list`, `metrics`, `pack`, `project`,
`update` — from `packages/cli/src/commands/`, together with every utility, error
module, schema, and test that becomes dead as a result. Keep the four remaining
commands (`build`, `create`, `install`, `use`) fully functional with their tests
passing. Do **not** touch `packages/cli/src/private/scaffold/`.

## Background

- Each public command file in `packages/cli/src/commands/<name>.ts` is a thin
  re-export of an implementation in `packages/cli/src/private/commands/<name>/`.
- Internal imports use the Node subpath-import alias `#*` (defined in
  `packages/cli/package.json#imports`): `#utils/…` → `./src/private/utils/…`,
  `#errors/…` → `./src/private/errors/…`, `#schemas/…` → `./src/private/schemas/…`,
  `#constants` → `./src/private/constants.ts`, `#test-utils/…` → `./src/private/test-utils/…`.
- The production entry point is `packages/cli/src/bin.ts`, which imports
  `./commands/index.js` (the command registry).

## Method

A static import-graph analysis was performed over every `.ts` file in
`packages/cli/src`, resolving both relative imports and the `#*` subpath aliases
to their source files. The keep set was computed as a fixed point:

1. **Production roots:** `bin.ts` and every file under `private/scaffold/`. The
   seven removed command wrappers are treated as blocked (i.e. we model
   `commands/index.ts` after it has been edited to drop them).
2. **Reachability closure:** every module reachable from the production roots
   (through `import … from`) is kept.
3. **Kept-command test roots:** the spec files of the four kept commands
   (`build.spec.ts`, `create.spec.ts`, `install.spec.ts`, `use.spec.ts`) are
   roots, so the `test-utils` and helpers those tests need are kept.
4. **Spec survives with its counterpart:** a spec file is kept iff its
   *counterpart* — the co-located `<name>.ts`, or otherwise the directory's
   `index.ts` — is kept. This is the decisive rule: a spec is not killed by an
   orphaned helper it happens to import; the helper is kept because the live
   spec needs it.
5. Re-close under imports after each newly-kept spec, until the fixed point
   stabilises.

**Keep rule (plain English):** a file is kept iff it is reachable from the
production entry (`bin` + `scaffold`) or from any kept spec, and a spec is kept
iff the module it tests is kept. Anything not reachable from either production
or a kept test is dead and is removed — including pre-existing spec-only dead
code (`applied-manifest`, `manifest`, `execute-steps`, `modify-engine`, `revert`,
`dependencies`, `check-output`, `validate-output`, `output-path`, `pre-flight`,
`resolve-template-string`, the `applied` and `instruction` schemas, etc.).

A spec is deleted only when its counterpart is deleted (it tests removed/dead
code). A helper (`test-utils`, `install-new.ts`, `git.ts`, `capture-stdout.ts`,
etc.) is kept whenever at least one kept spec still needs it.

The result was verified with a conflict check: **no kept file imports any
deleted file** (the only references to deleted files come from
`commands/index.ts`, which is edited — see below).

## Files to edit (not delete)

### `packages/cli/src/commands/index.ts`

Remove the seven imports and array entries for `add`, `find`, `list`, `metrics`,
`pack`, `project`, `update`. Keep `build`, `create`, `install`, `use`.

### `packages/cli/src/bin.ts`

Remove `examples` entries that reference removed or non-existent commands:

- `$ ${CLI_CMD} project init`
- `$ ${CLI_CMD} project init --harness claude`
- `$ ${CLI_CMD} update`
- `$ ${CLI_CMD} pack create my-package`
- `$ ${CLI_CMD} pack move my-package global`
- `$ ${CLI_CMD} find -q="summarize a pdf"`
- `$ ${CLI_CMD} info my-powerup` (the `info` command does not exist)

Keep the examples for `install`, `create`, and `use`.

## Files to delete — 81 total

### Command wrappers (7)

- `packages/cli/src/commands/add.ts`
- `packages/cli/src/commands/find.ts`
- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/metrics.ts`
- `packages/cli/src/commands/pack.ts`
- `packages/cli/src/commands/project.ts`
- `packages/cli/src/commands/update.ts`

### Command implementations + specs (19)

- `packages/cli/src/private/commands/add/add.spec.ts`
- `packages/cli/src/private/commands/add/index.ts`
- `packages/cli/src/private/commands/find/find.spec.ts`
- `packages/cli/src/private/commands/find/index.ts`
- `packages/cli/src/private/commands/list/index.ts`
- `packages/cli/src/private/commands/list/list.spec.ts`
- `packages/cli/src/private/commands/metrics/index.ts`
- `packages/cli/src/private/commands/metrics/summary.spec.ts`
- `packages/cli/src/private/commands/metrics/summary.ts`
- `packages/cli/src/private/commands/pack/create.spec.ts`
- `packages/cli/src/private/commands/pack/create.ts`
- `packages/cli/src/private/commands/pack/index.ts`
- `packages/cli/src/private/commands/pack/move.spec.ts`
- `packages/cli/src/private/commands/pack/move.ts`
- `packages/cli/src/private/commands/project/index.ts`
- `packages/cli/src/private/commands/project/init.spec.ts`
- `packages/cli/src/private/commands/project/init.ts`
- `packages/cli/src/private/commands/update/index.ts`
- `packages/cli/src/private/commands/update/update.spec.ts`

### Error modules (10)

- `packages/cli/src/private/errors/addErrors.ts`
- `packages/cli/src/private/errors/appliedErrors.ts`
- `packages/cli/src/private/errors/findErrors.ts`
- `packages/cli/src/private/errors/infoErrors.ts`
- `packages/cli/src/private/errors/listErrors.ts`
- `packages/cli/src/private/errors/packErrors.ts`
- `packages/cli/src/private/errors/powerErrors.ts`
- `packages/cli/src/private/errors/projectErrors.ts`
- `packages/cli/src/private/errors/updateErrors.ts`
- `packages/cli/src/private/errors/validateErrors.ts`

### Schemas (4)

- `packages/cli/src/private/schemas/applied.spec.ts`
- `packages/cli/src/private/schemas/applied.ts`
- `packages/cli/src/private/schemas/instruction.spec.ts`
- `packages/cli/src/private/schemas/instruction.ts`

### Utils (41)

- `packages/cli/src/private/utils/applied-manifest.spec.ts`
- `packages/cli/src/private/utils/applied-manifest.ts`
- `packages/cli/src/private/utils/check-output.spec.ts`
- `packages/cli/src/private/utils/check-output.ts`
- `packages/cli/src/private/utils/dependencies.spec.ts`
- `packages/cli/src/private/utils/dependencies.ts`
- `packages/cli/src/private/utils/execute-steps.spec.ts`
- `packages/cli/src/private/utils/execute-steps.ts`
- `packages/cli/src/private/utils/manifest.spec.ts`
- `packages/cli/src/private/utils/manifest.ts`
- `packages/cli/src/private/utils/metrics.spec.ts`
- `packages/cli/src/private/utils/metrics.ts`
- `packages/cli/src/private/utils/modify-engine.spec.ts`
- `packages/cli/src/private/utils/modify-engine.ts`
- `packages/cli/src/private/utils/move/build.spec.ts`
- `packages/cli/src/private/utils/move/build.ts`
- `packages/cli/src/private/utils/move/collect.spec.ts`
- `packages/cli/src/private/utils/move/collect.ts`
- `packages/cli/src/private/utils/move/copy.spec.ts`
- `packages/cli/src/private/utils/move/copy.ts`
- `packages/cli/src/private/utils/move/print.ts`
- `packages/cli/src/private/utils/move/validate.ts`
- `packages/cli/src/private/utils/move/verify.ts`
- `packages/cli/src/private/utils/output-path.spec.ts`
- `packages/cli/src/private/utils/output-path.ts`
- `packages/cli/src/private/utils/pre-flight.spec.ts`
- `packages/cli/src/private/utils/pre-flight.ts`
- `packages/cli/src/private/utils/project-path.spec.ts`
- `packages/cli/src/private/utils/project-path.ts`
- `packages/cli/src/private/utils/resolve-powerup.spec.ts`
- `packages/cli/src/private/utils/resolve-powerup.ts`
- `packages/cli/src/private/utils/resolve-template-string.spec.ts`
- `packages/cli/src/private/utils/resolve-template-string.ts`
- `packages/cli/src/private/utils/revert.spec.ts`
- `packages/cli/src/private/utils/revert.ts`
- `packages/cli/src/private/utils/score-intent.ts`
- `packages/cli/src/private/utils/tokenize.ts`
- `packages/cli/src/private/utils/update-package.spec.ts`
- `packages/cli/src/private/utils/update-package.ts`
- `packages/cli/src/private/utils/validate-output.spec.ts`
- `packages/cli/src/private/utils/validate-output.ts`

## Explicitly kept (out of scope)

- `packages/cli/src/private/scaffold/` — the entire folder. It is not reachable
  from any command and is left untouched.
- The four kept commands and everything they reach: `build`, `create`,
  `install`, `use`, their `private/commands/<name>/**` implementations, and all
  of their utils, errors (`buildErrors`, `createErrors`, `installErrors`), and
  schemas (`modification`, `package`).
- All `private/utils/use/**` step code and its specs
  (`run-powerup`, `run-create-step`, `run-delete-step`, `run-install-step`,
  `run-modify-step`, `run-read-step`, `resolve-step-variables`, `save-manifest`,
  `extract-variables`, `get-powerup/*`, `check-for-pre-use-errors/*`,
  `check-for-use-preflight-errors/*`, etc.).
- Test helpers kept alive by kept tests, even though no production code uses
  them:
  - `packages/cli/src/private/test-utils/capture-stdout.ts` — used by the kept
    `build/copy-templates-to-dist-folder.spec.ts`.
  - `packages/cli/src/private/commands/install/install-new.ts` — used by the kept
    `install.spec.ts`.
  - `packages/cli/src/private/utils/git.ts` (+ `git.spec.ts`) — used by the kept
    `create-fully-built-powerup-for-test.ts` and
    `create-simple-project-for-test.ts` test helpers.
  - `packages/cli/src/private/utils/build/copy-templates-to-dist-folder.ts`
    (+ its spec) — used by the kept `build` command and its test.
- Empty directories left behind by deletions are removed (git drops empty
  directories on commit).

## Verification

After the changes:

1. `tsgo` (build) must pass — confirms no dangling imports in production code.
2. `eslint .` must pass.
3. `npx proby` (test suite) must pass — only the kept-command and kept-util
   specs run; none reference deleted code.

The static conflict check already guarantees no kept file imports any deleted
file, so steps 1 and 3 should pass on the first try once `commands/index.ts`
and `bin.ts` are edited.

## Rollback

The change is a pure deletion + two small edits, all in one commit. Reverting
the commit restores the removed commands and their fallout exactly.