# TODO: README Autogeneration (CLI + Root)

Plan: `docs/superpowers/plans/2026-09-03-readme-autogeneration-plan.md`

Status: **complete** — all tasks done. (sdk test failure and knip findings are
pre-existing; CLI test failures are network-fetch tests, environmental.)

## Phase 1: CLI readme pipeline

## Task 1: CLI readme generator script + njk template ✓

**Description:** Created `packages/cli/scripts/generate-readme.ts` (bun) that
imports the built command registry `../lib/commands/index.js`, extracts
per-command metadata (`name`, `description`, `flags`, `subcommandNames`), and
renders `packages/cli/scripts/templates/readme.njk` into
`packages/cli/README.md`. Added the `readme` package script.

**Acceptance criteria:**
- [x] `pnpm --filter @liolocs/powerups-cli build && pnpm --filter @liolocs/powerups-cli readme` writes `packages/cli/README.md` containing all five commands (`build`, `create`, `install`, `uninstall`, `use`) with descriptions and flag tables matching the `Command` objects
- [x] Script exits with an actionable error ("build the CLI first") when `lib/commands/index.js` is absent
- [x] Flag metadata renders `long`, `short`, `description`, `type` (e.g. `--dry-run` / `-dr` for every command that has it)
- [x] Second run produces byte-identical output (verified via shasum)

**Verification:**
- [x] Manual check: regenerated and diffed — byte-identical
- [x] `pnpm lint` — new CLI script carries the same pre-existing parsing-error class as sibling scripts; no new findings

**Files touched:**
- `packages/cli/scripts/generate-readme.ts` (new)
- `packages/cli/scripts/templates/readme.njk` (new)
- `packages/cli/package.json` (readme script)
- `packages/cli/README.md` (generated)

## Task 2: CLI readme template content pass ✓

**Acceptance criteria:**
- [x] Generated README contains no stale commands (`project init`, `add`, `list`, `pack create/move`, `find`, `info`, `update`, `validate`, `metrics`, `doctor`)
- [x] Every generated command section matches the live `Command` metadata in `src/private/commands/<name>/index.ts`
- [x] README reads as a complete standalone document (install → quick start → command reference → concepts → development → license)

**Notes:** nunjucks `renderString` autoescapes by default — the generator
creates an `Environment` with `autoescape: false` so descriptions render raw;
a `collapseBlankLines` normalization keeps section spacing deterministic.

## Checkpoint: After Tasks 1-2 ✓
- [x] CLI readme pipeline works end to end and is idempotent

## Phase 2: Package readme + root readme pipeline

## Task 3: Hand-written `packages/program/README.md` ✓

**Acceptance criteria:**
- [x] `packages/program/README.md` exists and covers purpose, private status, and consumption model
- [x] Consistent in tone/format with `packages/sdk/README.md`

## Task 4: Root readme generator script + njk template ✓

**Acceptance criteria:**
- [x] `pnpm readme` writes a root `README.md` listing all three packages (`cli`, `program`, `sdk`) with correct names, one-line descriptions, publish status, and working `./packages/<name>/README.md` links
- [x] No `apps/` content appears in the generated output
- [x] Stale sections fixed: package table includes the SDK; "Monorepo layout" section dropped
- [x] Second run produces byte-identical output (verified via shasum)

**Files touched:**
- `scripts/generate-root-readme.ts` (new)
- `scripts/templates/root-readme.njk` (new)
- `package.json` (readme script + nunjucks/@types/nunjucks devDependencies)
- `pnpm-lock.yaml` (install)
- `README.md` (generated)
- `.gitignore` (.pnpm-store/)

## Checkpoint: After Tasks 3-4
- [x] Root readme pipeline works end to end and is idempotent
- [x] All package links resolve (cli, program, sdk readmes exist)

## Phase 3: Verification and wiring

## Task 5: Housekeeping, docs, and workspace checks ✓

**Acceptance criteria:**
- [x] Rerunning each generator is byte-identical
- [x] `CONTRIBUTING.md` documents the regeneration flow (new "Generated readmes" section)
- [x] Workspace checks: `pnpm lint`, `pnpm knip`, and `pnpm -r test` — failures are all pre-existing/environmental and untouched by this work:
  - knip: pre-existing unused-export findings, none in the new files
  - sdk tests: pre-existing Zod date-parse failure in `manifest.spec.ts`
  - cli tests: 362 pass, 8 fail — all `Failed to fetch npm:@liolocs/powerup-hello-world` (network-dependent tests)
  - program tests: 22/22 pass

## Checkpoint: Complete
- [x] All acceptance criteria met
- [x] Ready for review
