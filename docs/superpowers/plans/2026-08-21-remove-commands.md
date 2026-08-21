# Remove 7 CLI Commands and Their Fallout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `add`, `find`, `list`, `metrics`, `pack`, `project`, and `update` commands from `packages/cli/src/commands/`, plus every utility, error module, schema, and test that becomes dead as a result — while keeping `build`, `create`, `install`, `use` and `private/scaffold/` fully intact.

**Architecture:** This is a pure deletion plus two small registry edits. The public command files in `commands/` are thin re-exports of implementations in `private/commands/<name>/`; internal code is imported via the `#*` subpath alias (`package.json#imports` → `./src/private/*`). The deletion set (81 files) was computed by a static import-graph reachability analysis and verified to leave no dangling imports. The two edited files are the command registry (`commands/index.ts`) and the CLI entry (`bin.ts`).

**Tech Stack:** TypeScript (NodeNext / `tsgo`), `tsup`, `eslint`, `proby` test runner, `pnpm` workspace, git.

**Spec:** `docs/superpowers/specs/2026-08-21-remove-commands-design.md`

---

## File Structure

**Modified (2 files):**
- `packages/cli/src/commands/index.ts` — the command registry. Remove the 7 imports and array entries for the deleted commands; keep `build`, `create`, `install`, `use`.
- `packages/cli/src/bin.ts` — the CLI entry point. Remove `examples` entries referencing removed/non-existent commands.

**Deleted (81 files):** 7 command wrappers, 19 command-implementation files (incl. specs) under `private/commands/{add,find,list,metrics,pack,project,update}/`, 10 error modules, 4 schema files, 41 util files (incl. specs). The full enumerated list is in Task 3.

**Untouched:** `packages/cli/src/private/scaffold/` (entire folder), the four kept commands and everything they reach, all `private/utils/use/**` step code, and the test helpers kept alive by kept tests (`capture-stdout.ts`, `install/install-new.ts`, `utils/git.ts`, `utils/build/copy-templates-to-dist-folder.ts`).

---

## Ordering rationale

The edits must land before (or with) the deletions so the tree always compiles:

1. Editing `commands/index.ts` first stops the registry from referencing the soon-to-be-deleted wrappers. After this edit the wrappers are merely unreferenced (still compile, since each still re-exports an existing impl) — so the build still passes.
2. Editing `bin.ts` is independent and safe any time.
3. Deleting all 81 files at once: at the moment of deletion, `commands/index.ts` no longer imports the wrappers, so removing the wrappers and their impls together leaves no dangling reference. Build passes immediately after.

---

### Task 1: Edit the command registry

**Files:**
- Modify: `packages/cli/src/commands/index.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `packages/cli/src/commands/index.ts` with:

```ts
import { type Command } from "@liolocs/program";
import build from "./build.js";
import create from "./create.js";
import install from "./install.js";
import use from "./use.js";

const commands: Command<any>[] = [
  build,
  create,
  install,
  use,
];
export default commands;
```

- [ ] **Step 2: Verify the build still passes**

Run: `cd packages/cli && npx tsgo`
Expected: compiles with no errors. (The 7 wrappers still exist on disk and still compile; they are just no longer referenced.)

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/index.ts
git commit -m "refactor: drop removed commands from the command registry"
```

---

### Task 2: Edit the CLI entry examples

**Files:**
- Modify: `packages/cli/src/bin.ts`

- [ ] **Step 1: Trim the `examples` array**

In `packages/cli/src/bin.ts`, find the `examples:` array and replace this block:

```ts
  examples: [
    `$ ${CLI_CMD} project init`,
    `$ ${CLI_CMD} project init --harness claude`,
    `$ ${CLI_CMD} install npm:my-package`,
    `$ ${CLI_CMD} install npm:my-package -l`,
    `$ ${CLI_CMD} update`,
    `$ ${CLI_CMD} pack create my-package`,
    `$ ${CLI_CMD} create my-powerup`,
    `$ ${CLI_CMD} create my-powerup --working-dir`,
    `$ ${CLI_CMD} pack move my-package global`,
    `$ ${CLI_CMD} find -q="summarize a pdf"`,
    `$ ${CLI_CMD} info my-powerup`,
    `$ ${CLI_CMD} use my-powerup --var name=foo`,
  ],
```

with:

```ts
  examples: [
    `$ ${CLI_CMD} install npm:my-package`,
    `$ ${CLI_CMD} install npm:my-package -l`,
    `$ ${CLI_CMD} install git:<source>`,
    `$ ${CLI_CMD} install git:<source> -l`,
    `$ ${CLI_CMD} create <powerup-name>`,
    `$ ${CLI_CMD} create <powerup-name> --capture=all`,
    `$ ${CLI_CMD} create <powerup-name> --capture=workingDir`,
    `$ ${CLI_CMD} use <powerup-name> --var name=foo`,
  ],
```

This removes examples for `project init`, `update`, `pack create`, `pack move`, `find`, and the non-existent `info` command, keeping `install`, `create`, and `use`.

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/bin.ts
git commit -m "refactor: drop removed-command examples from bin.ts"
```

---

### Task 3: Delete the 81 dead files

**Files:** the 81 files enumerated in the grouped `git rm` commands below.

- [ ] **Step 1: Delete the 7 command wrappers**

```bash
git rm \
  packages/cli/src/commands/add.ts \
  packages/cli/src/commands/find.ts \
  packages/cli/src/commands/list.ts \
  packages/cli/src/commands/metrics.ts \
  packages/cli/src/commands/pack.ts \
  packages/cli/src/commands/project.ts \
  packages/cli/src/commands/update.ts
```

- [ ] **Step 2: Delete the 7 command-implementation directories (19 files, incl. specs)**

```bash
git rm -r \
  packages/cli/src/private/commands/add \
  packages/cli/src/private/commands/find \
  packages/cli/src/private/commands/list \
  packages/cli/src/private/commands/metrics \
  packages/cli/src/private/commands/pack \
  packages/cli/src/private/commands/project \
  packages/cli/src/private/commands/update
```

- [ ] **Step 3: Delete the 10 error modules**

```bash
git rm \
  packages/cli/src/private/errors/addErrors.ts \
  packages/cli/src/private/errors/appliedErrors.ts \
  packages/cli/src/private/errors/findErrors.ts \
  packages/cli/src/private/errors/infoErrors.ts \
  packages/cli/src/private/errors/listErrors.ts \
  packages/cli/src/private/errors/packErrors.ts \
  packages/cli/src/private/errors/powerErrors.ts \
  packages/cli/src/private/errors/projectErrors.ts \
  packages/cli/src/private/errors/updateErrors.ts \
  packages/cli/src/private/errors/validateErrors.ts
```

- [ ] **Step 4: Delete the 4 schema files**

```bash
git rm \
  packages/cli/src/private/schemas/applied.spec.ts \
  packages/cli/src/private/schemas/applied.ts \
  packages/cli/src/private/schemas/instruction.spec.ts \
  packages/cli/src/private/schemas/instruction.ts
```

- [ ] **Step 5: Delete the 41 util files**

```bash
git rm \
  packages/cli/src/private/utils/applied-manifest.spec.ts \
  packages/cli/src/private/utils/applied-manifest.ts \
  packages/cli/src/private/utils/check-output.spec.ts \
  packages/cli/src/private/utils/check-output.ts \
  packages/cli/src/private/utils/dependencies.spec.ts \
  packages/cli/src/private/utils/dependencies.ts \
  packages/cli/src/private/utils/execute-steps.spec.ts \
  packages/cli/src/private/utils/execute-steps.ts \
  packages/cli/src/private/utils/manifest.spec.ts \
  packages/cli/src/private/utils/manifest.ts \
  packages/cli/src/private/utils/metrics.spec.ts \
  packages/cli/src/private/utils/metrics.ts \
  packages/cli/src/private/utils/modify-engine.spec.ts \
  packages/cli/src/private/utils/modify-engine.ts \
  packages/cli/src/private/utils/move/build.spec.ts \
  packages/cli/src/private/utils/move/build.ts \
  packages/cli/src/private/utils/move/collect.spec.ts \
  packages/cli/src/private/utils/move/collect.ts \
  packages/cli/src/private/utils/move/copy.spec.ts \
  packages/cli/src/private/utils/move/copy.ts \
  packages/cli/src/private/utils/move/print.ts \
  packages/cli/src/private/utils/move/validate.ts \
  packages/cli/src/private/utils/move/verify.ts \
  packages/cli/src/private/utils/output-path.spec.ts \
  packages/cli/src/private/utils/output-path.ts \
  packages/cli/src/private/utils/pre-flight.spec.ts \
  packages/cli/src/private/utils/pre-flight.ts \
  packages/cli/src/private/utils/project-path.spec.ts \
  packages/cli/src/private/utils/project-path.ts \
  packages/cli/src/private/utils/resolve-powerup.spec.ts \
  packages/cli/src/private/utils/resolve-powerup.ts \
  packages/cli/src/private/utils/resolve-template-string.spec.ts \
  packages/cli/src/private/utils/resolve-template-string.ts \
  packages/cli/src/private/utils/revert.spec.ts \
  packages/cli/src/private/utils/revert.ts \
  packages/cli/src/private/utils/score-intent.ts \
  packages/cli/src/private/utils/tokenize.ts \
  packages/cli/src/private/utils/update-package.spec.ts \
  packages/cli/src/private/utils/update-package.ts \
  packages/cli/src/private/utils/validate-output.spec.ts \
  packages/cli/src/private/utils/validate-output.ts
```

- [ ] **Step 6: Verify the test suite passes**

Run: `cd packages/cli && npm test`
Expected: all kept-command and kept-util specs pass; no spec references deleted code. (The `use/run-powerup/**`, `build/**`, `create/**`, `install/**` specs and their `test-utils` — including `capture-stdout.ts`, `git.ts`, `install-new.ts`, `copy-templates-to-dist-folder.ts` — all remain and pass.)

- [ ] **Step 7: Commit**

```bash
git add -A packages/cli
git commit -m "refactor: remove add/find/list/metrics/pack/project/update commands and their dead fallout"
```

---

### Task 4: Final verification

- [ ] **Step 1: Confirm `private/scaffold/` is untouched**

Run: `git status -- packages/cli/src/private/scaffold && ls packages/cli/src/private/scaffold`
Expected: no changes; the folder still contains `agents.ts`, `detect.ts`, `index.ts`, `write.ts`, their specs, and `templates/`.

- [ ] **Step 2: Show the resulting diff summary**

Run: `git log --oneline -3 && git diff --stat HEAD~3 HEAD -- packages/cli`
Expected: 3 commits; the diff stat shows `commands/index.ts` and `bin.ts` modified, 81 files deleted, scaffold untouched.