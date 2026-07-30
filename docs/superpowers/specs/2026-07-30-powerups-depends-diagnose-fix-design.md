# Powerup Dependencies, Diagnose, Fix Loop & Versioning — Design

**Date:** 2026-07-30
**Status:** Approved (design), pending user spec review
**Scope:** `packages/cli` (`pup`)

## Problem

Three maintainability gaps threaten adoption of powerups:

1. **No dependency model.** Powerups can `include` each other (composition at
   use-time) but cannot declare that they *depend on* another powerup having
   been applied first (e.g. a `shadcn` powerup requiring `init`).
2. **No attribution.** After `pup use`, nothing records which powerup wrote
   which files, so when a dev environment breaks there is no way to trace the
   failure back to the powerup that caused it — and no way to fold a fix back
   into the originating powerup.
3. **No compatibility/version model.** Powerups inherit their pack's version
   and cannot express "valid for primate@^0.30" vs "valid for primate@^0.31".
   Supporting a new version of a framework means clobbering the old powerup.

If maintaining powerups is hard, nobody maintains them, and the system dies.

## Foundational decision: one powerup per pack

Every pack contains exactly one powerup. The pack *is* the powerup's versioned,
named, publishable identity.

Rationale: this **deletes concepts instead of adding them**:

- instructions.json stays schema-simple (no variant sets, no branching).
- Versioning reuses real semver + npm registry machinery that already exists.
- Compatibility across framework versions becomes "version lines of the same
  package," the standard npm pattern: `primate-init@1.x` declares compatibility
  with `primate@^0.30`; `primate-init@2.0.0` declares `^0.31`. One package name,
  two version lines, resolver picks the right one. **Not** one package per
  framework version.
- Depends = pack-to-pack dependency = the npm dependency model.
- Fork-on-fix = fork the pack (already the unit of ownership).
- Diagnose attribution = file → powerup → pack@version, unambiguous.
- Discovery: one pack = one intent = one name.

### Migration

No automated tooling. The only multi-powerup pack that must be migrated is the
repo's own internal pack, `.powerups/internal/pup-internal/`, which currently
bundles three multi-use powerups (`cli-command`, `cli-subcommand`,
`cli-command-with-subcommands`). It is updated **by hand**: each powerup
becomes its own pack (own directory with a `package.json` containing a single
`powerups.active` entry). Any `include` steps referencing sibling powerups in
the same pack are converted to `depends` entries at the same time. `include`
remains supported for backward compatibility during a deprecation window.

## Architecture

Four subsystems, each independently testable:

```
┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐
│  Applied-   │   │  Depends     │   │  Diagnose   │   │  Fix loop    │
│  state      │──▶│  resolution  │──▶│  engine     │──▶│  (start/end) │
│  manifest   │   │  (npm model) │   │  + blame    │   │  + version   │
└─────────────┘   └──────────────┘   └─────────────┘   └──────────────┘
```

- **Manifest** is written by `use`, read by everything else.
- **Resolution** runs before `use` applies anything.
- **Diagnose** reads manifest + runs user commands.
- **Fix loop** reuses `pup create`'s git-diff-to-modifications pipeline.

## Subsystem 1: Applied-state manifest

**File:** `.<CLI_NAME>/applied.json` in the project store (the existing
`MAIN_FOLDER`). Owned entirely by `pup`; users never edit it.

Written by `pup use` after a successful apply (we already have `changedFiles`
at the copy-back point — the natural hook). Shape:

```json
{
  "version": 1,
  "applied": [
    {
      "powerup": "@powerups/primate-init",
      "version": "2.0.0",
      "store": "npm",
      "appliedAt": "2026-07-30T12:00:00Z",
      "variables": { "name": "my-app" },
      "files": [
        { "path": "src/app.ts", "action": "create" },
        { "path": "package.json", "action": "modify" }
      ],
      "dependsOn": ["@powerups/base-init@^1.0.0"]
    }
  ]
}
```

Semantics:

- Idempotency within `use`: if apply fails, no manifest entry is written.
- Re-applying the same powerup replaces its entry (files list refreshed).
- `delete`-step results are recorded: a file deleted by a powerup is removed
  from *other* entries' file lists if present, and recorded with
  `"action": "delete"` in its own entry.
- Single-use vs multi-use: re-applying a multi-use powerup with different
  variables appends a new entry (same powerup, distinct variable set — keyed
  by `powerup + canonical(variables)`).

## Subsystem 2: Depends (dependency declaration & auto-resolution)

**Declaration** — in the pack's `package.json` (not instructions.json):

```json
{
  "name": "@powerups/shadcn",
  "version": "1.0.0",
  "powerups": {
    "depends": { "@powerups/base-init": "^1.0.0" },
    "compatibility": { "primate": "^0.31.0" }
  }
}
```

- `depends`: map of powerup pack name → semver range. Standard npm dependency
  semantics.
- `compatibility`: map of project package name → semver range that must be
  satisfied by the *target project's* installed versions at use-time.

**Auto-resolution** (`pup use <name>`):

1. Build the dependency graph from `depends` (transitive, depth-first,
   topological order).
2. Skip any dependency already satisfied by the manifest (name matches and
   applied version satisfies the range).
3. Missing dependencies are installed from the registry/store if not present
   locally, then applied in topological order *before* the requested powerup.
4. Cycles → hard error naming the cycle.
5. Diamond dedup: a dep required twice is applied once, highest satisfying
   version.
6. Compatibility gate: before applying each powerup, read the project's
   installed version of each `compatibility` key (from the project root
   `package.json` + lockfile detection if needed). Unsatisfied → error listing
   every violated range, e.g.:
   `shadcn@1.0.0 requires primate@^0.31.0, project has primate@0.30.2`.
7. Flags: `--no-deps` (skip auto-resolution, apply only the named powerup),
   `--dry-run` prints the full apply plan without executing.

**Version-aware store:** `~/.pup/npm/` and `~/.pup/git/` become
`<name>/<version>/` directories. Resolution reads the target project's
compatibility requirements, queries available versions (local store first,
then registry), and selects the highest satisfying version. Two projects with
different primate versions coexist via different pack versions.

## Subsystem 3: Diagnose

Two surfaces sharing one attribution engine.

**Attribution engine** (library code): given a file path, return the manifest
entries whose file list contains it: powerup, pack@version, appliedAt,
variables. Handles multi-use re-applications by returning all matching entries
(newest first).

**`pup diagnose [-- <cmd>]`** — the magic moment:

- `pup diagnose -- npm run dev`: runs the command (streaming output through),
  captures stderr/stdout, parses file paths from stack traces and common
  compiler error formats (TS, ESLint, node/bun stack frames), maps each
  through the attribution engine.
- Report, grouped by powerup:

```
✗ Failure attributed to powerups:

  src/components/ui/button.tsx
    ← @powerups/shadcn@1.0.0 (applied 2026-07-30)
    fix: pup fix @powerups/shadcn start

  Unattributed errors (2) — files not written by any powerup:
    src/custom/thing.ts
```

- Files not in any manifest entry are listed separately ("unattributed") —
  honest signal, never guess.
- `pup diagnose` with no command: interactive — shows recently-applied
  powerups (newest first) and lets the user paste an error or pick files.
- Exit code: pass through the wrapped command's exit code, so it composes in
  scripts.

**`pup blame <file>`** — thin wrapper over the attribution engine: prints the
powerup(s), version, apply date, and variables for a file. Nearly free once
the engine exists.

## Subsystem 4: Fix loop

**`pup fix <powerup> start`**:

1. Resolve the powerup in the project's manifest (error if never applied).
2. **Fork-on-fix:** if the pack is not local (project store / linked pack
   directory), copy it into the project store as a fork. Update the manifest
   entry to point at the fork (`store: "project"`). If already local, fix in
   place — no fork.
3. Create a git worktree/branch (reusing the existing worktree utils)
   containing the project state; record the base commit in
   `.<CLI_NAME>/fix-session.json` (powerup, fork path, base commit, startedAt).
4. Tell the user: edit the files attributed to the powerup (list them), then
   run `pup fix <powerup> end`.

**`pup fix <powerup> end`**:

1. Read the fix session; diff base commit → working tree.
2. Restrict the diff to files attributed to this powerup (from the manifest)
   plus any *new* files created during the session. Warn about edits to files
   attributed to *other* powerups (suggest separate fix sessions; `--include`
   flag to deliberately fold them in).
3. Convert the diff to powerup steps via the existing
   `diff-to-modifications` / `generateModifications` pipeline (the same one
   `pup create` uses) and merge into the fork's templates/instructions.
4. **Version handling:** read the project's current versions of every package
   in the fork's `compatibility` map:
   - All still satisfy the declared ranges → bump the fork's **patch** version.
   - Any now violates the declared range (i.e. the fix targets a new framework
     version) → this fix is a **new version line**: bump the fork's **major**
     version and update the compatibility range to match the project (user
     confirms interactively, e.g. `primate ^0.30 → ^0.31`). The old version
     line is untouched and continues to serve older projects.
   - Fix touches `packageDependencies`: diff and merge into the fork's
     package.json dependencies.
5. Re-render the updated powerup into the project (`use` semantics with the
   manifest's recorded variables) so project and powerup are in sync.
6. Update the manifest entry (new version, refreshed files list).
7. Delete the fix session file; clean up.

Guard rails: only one active fix session at a time; `pup fix abort` discards
the session and worktree without touching anything.

## Data flow (end-to-end example)

```
pup use @powerups/shadcn
  → resolve depends → auto-apply @powerups/base-init first
  → compatibility gate (primate ^0.31 ✓)
  → apply, write manifest entries for both

npm run dev breaks
  → pup diagnose -- npm run dev
  → attributes button.tsx to @powerups/shadcn@2.0.0

pup fix @powerups/shadcn start
  → fork into project store, snapshot base commit
  → user edits button.tsx; also bumps primate to 0.31 in package.json

pup fix @powerups/shadcn end
  → diff → generateModifications → update fork templates
  → primate now violates ^0.30 → major bump 3.0.0, compatibility ^0.31
  → re-render into project, update manifest

Older projects (primate 0.30) still resolve @powerups/shadcn@2.x. New
projects resolve 3.x. Both maintained from one pack name.
```

## Error handling

- **Cycle in depends:** hard error before any apply, naming the cycle path.
- **Unsatisfiable compatibility:** error listing each violated range with the
  project's actual version; suggest `pup use <name>@<range>` override or a fix
  session.
- **Diagnose with no attribution:** report unattributed files plainly; never
  fabricate a culprit.
- **Fix session on dirty unrelated state:** start requires a clean tree
  outside the attributed files, or `--force`; end refuses if the session file
  is missing/corrupt and explains recovery (`git` state is the source of
  truth).
- **Manifest missing/corrupt:** commands that need it fail with instructions
  to re-run `pup use` for the powerups they know were applied (`pup doctor`
  gains a manifest-health check).
- **Fork write failures:** fork-on-fix is atomic (copy to temp, then rename);
  a failed fork leaves the original manifest entry untouched.

## Testing

- **Manifest:** unit tests for write/replace/multi-use-append semantics and
  delete-step bookkeeping (mirroring existing `use.spec.ts` harness).
- **Resolution:** graph builder unit tests — topological order, skip-if-
  satisfied, cycles, diamonds, version selection from a version-aware store.
- **Compatibility gate:** fixture projects with pinned package versions;
  satisfy/violate/missing cases.
- **Attribution/diagnose:** fixture error outputs (tsc, ESLint, node stack
  trace) → expected attributions; pass-through exit code test.
- **Fix loop:** end-to-end spec — apply fixture powerup, edit, end, assert
  fork templates updated + version bump rules (patch vs major) + manifest
  refreshed + re-render. Reuse the git-worktree test utils from
  `create-powerup.spec.ts`.
- **Migration:** manual verification that the hand-split `pup-internal` packs
  validate (`pup validate`) and render identically to the pre-split behavior
  for the three CLI-scaffolding powerups.

## Non-goals

- No centralized dependency *lockfile* beyond the manifest (the manifest is
  the record of truth; resolution is deterministic given ranges + registry).
- No removal of `include` in this cycle (deprecation window only).
- No version pinning UI beyond `@range` specifiers on `use`
  (e.g. `pup use @powerups/shadcn@^2`).
- No cross-project manifest sharing; attribution is per-project.
