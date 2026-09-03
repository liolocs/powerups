# TODO: README Autogeneration (CLI + Root)

Plan: `docs/superpowers/plans/2026-09-03-readme-autogeneration-plan.md`

## Phase 1: CLI readme pipeline

## Task 1: CLI readme generator script + njk template

**Description:** Create `packages/cli/scripts/generate-readme.ts` (bun) that imports the built command registry `../lib/commands/index.js`, extracts per-command metadata (`name`, `description`, `flags`, `subcommandNames`), and renders `packages/cli/scripts/templates/readme.njk` into `packages/cli/README.md`. Add the `readme:generate` package script.

**Acceptance criteria:**
- [ ] Running `pnpm --filter @liolocs/powerups-cli build && pnpm --filter @liolocs/powerups-cli readme:generate` writes `packages/cli/README.md` containing all five commands (`build`, `create`, `install`, `uninstall`, `use`) with descriptions and flag tables matching the `Command` objects
- [ ] Script exits with an actionable error ("run the build first") when `lib/commands/index.js` is absent
- [ ] Flag metadata renders `long`, `short`, `description`, `type` (e.g. `--dry-run` / `-dr` for every command that has it)
- [ ] Second run produces byte-identical output

**Verification:**
- [ ] Manual check: run the two commands above and diff the regenerated README against the previous output
- [ ] `pnpm lint` passes

**Dependencies:** None

**Files likely touched:**
- `packages/cli/scripts/generate-readme.ts` (new)
- `packages/cli/scripts/templates/readme.njk` (new)
- `packages/cli/package.json` (add script)
- `packages/cli/README.md` (generated)

**Estimated scope:** Medium: 3-5 files

## Task 2: CLI readme template content pass

**Description:** Port the static sections of the current README (intro + badge, Install, Quick start, Concepts, Development, License) into `readme.njk` and remove the stale hand-maintained command table (superseded by the generated per-command sections).

**Acceptance criteria:**
- [ ] Generated README contains no stale commands (`project init`, `add`, `list`, `pack create/move`, `find`, `info`, `update`, `validate`, `metrics`, `doctor`)
- [ ] Every generated command section matches the live `Command` metadata in `src/private/commands/<name>/index.ts`
- [ ] README reads as a complete standalone document (install → quick start → command reference → concepts → development → license)

**Verification:**
- [ ] Manual check: regenerate and read the output top to bottom
- [ ] Manual check: spot-compare two commands' flags against their source index.ts

**Dependencies:** Task 1

**Files likely touched:**
- `packages/cli/scripts/templates/readme.njk`
- `packages/cli/README.md` (generated)

**Estimated scope:** Small: 1-2 files

## Checkpoint: After Tasks 1-2
- [ ] CLI readme pipeline works end to end and is idempotent
- [ ] `pnpm lint` and `pnpm test` pass
- [ ] Review with human before proceeding

## Phase 2: Package readme + root readme pipeline

## Task 3: Hand-written `packages/program/README.md`

**Description:** Write a small readme for `@liolocs/program` so every root-readme package link resolves: purpose (CLI/Command primitives on `@rcompat/cli`), `private: true` status, and how the CLI consumes it (devDependency bundled by tsup).

**Acceptance criteria:**
- [ ] `packages/program/README.md` exists and covers purpose, private status, and consumption model
- [ ] Consistent in tone/format with `packages/sdk/README.md` (no generated content needed)

**Verification:**
- [ ] Manual check: readme renders sensibly on GitHub-style markdown preview

**Dependencies:** None (can run in parallel with Task 1-2)

**Files likely touched:**
- `packages/program/README.md` (new)

**Estimated scope:** Small: 1 file

## Task 4: Root readme generator script + njk template

**Description:** Create top-level `scripts/generate-root-readme.ts` + `scripts/templates/root-readme.njk`. The script globs `packages/*/package.json` (apps excluded), extracts `{ name, description, version, isPrivate, readmePath }`, and renders the root `README.md`: succinct per-package entries with links to each package readme, plus the existing narrative prose moved into the template. Add `readme:generate` to the root `package.json` and `nunjucks` to root devDependencies.

**Acceptance criteria:**
- [ ] `pnpm readme:generate` writes a root `README.md` listing all three packages (`cli`, `program`, `sdk`) with correct names, one-line descriptions, publish status, and working `./packages/<name>/README.md` links
- [ ] No `apps/` content appears in the generated output
- [ ] Stale sections fixed: package table includes the SDK; "Monorepo layout" no longer claims no apps exist
- [ ] Second run produces byte-identical output

**Verification:**
- [ ] Manual check: regenerate, follow every package link, confirm targets exist
- [ ] `pnpm install` succeeds with the new devDependency
- [ ] `pnpm lint` passes

**Dependencies:** Task 3 (so links resolve); logically after Task 1-2 (CLI readme exists to link to)

**Files likely touched:**
- `scripts/generate-root-readme.ts` (new)
- `scripts/templates/root-readme.njk` (new)
- `package.json` (script + devDependency)
- `README.md` (generated)

**Estimated scope:** Medium: 3-5 files

## Checkpoint: After Tasks 3-4
- [ ] Root readme pipeline works end to end and is idempotent
- [ ] All package links resolve
- [ ] Review with human before proceeding

## Phase 3: Verification and wiring

## Task 5: Housekeeping, docs, and workspace checks

**Description:** Confirm both generators are deterministic and the workspace is healthy; document the regeneration flow.

**Acceptance criteria:**
- [ ] Rerunning each generator is byte-identical
- [ ] `pnpm lint`, `pnpm knip`, and `pnpm test` pass across the workspace
- [ ] `CONTRIBUTING.md` documents: after changing command metadata or package descriptions, rebuild and run both `readme:generate` scripts

**Verification:**
- [ ] Full check suite: `pnpm lint && pnpm knip && pnpm test`
- [ ] Manual check: regenerate both readmes one final time

**Dependencies:** Tasks 1-4

**Files likely touched:**
- `CONTRIBUTING.md`
- `packages/cli/README.md`, `README.md` (final regeneration)

**Estimated scope:** Small: 1-2 files

## Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review
