# Plan: Remove Old Create Command Code

## Context

The new `create` command (`create-new.ts`) is fully implemented and tested. The old `create` command (`index.ts`) and its utility files are now dead code. This plan removes all old files and updates the 2 files that still reference them.

## Dependency Analysis

The old create command's dependency tree:

```
commands/create/index.ts
  └── utils/create/create-powerup.ts
        ├── utils/create/get-package-deps.ts
        ├── utils/create/steps/index.ts
        │     ├── utils/create/git/git-status.ts
        │     ├── utils/create/steps/extract-deps-from-package-changes.ts
        │     ├── utils/create/steps/create-step-from-modified-file.ts
        │     │     ├── utils/create/git/git-status.ts (type import)
        │     │     ├── utils/create/steps/wrap-as-template.ts
        │     │     ├── utils/create/steps/generate-step-name.ts
        │     │     └── utils/create/git/diff-to-modifications.ts
        │     ├── utils/create/steps/create-step-from-new-file.ts
        │     │     ├── utils/create/git/git-status.ts (type import)
        │     │     ├── utils/create/steps/wrap-as-template.ts
        │     │     └── utils/create/steps/generate-step-name.ts
        │     └── utils/create/steps/create-step-from-deleted-file.ts
        │           ├── utils/create/git/git-status.ts (type import)
        │           └── utils/create/steps/generate-step-name.ts
        └── utils/config.ts (addPackageToConfig — still used by new code)
```

**Files referencing old code that need updating:**
1. `packages/cli/src/commands/create.ts` — CLI entry point, imports from old `create/index.ts`
2. `packages/cli/src/private/commands/doctor/doctor.spec.ts` — imports old create command for test setup

**No new code references any old files** — all new utilities in `utils/create/capture-files/`, `utils/create/check-for-pre-create-errors/`, etc. are self-contained.

## Phase 1: Delete old files (15 files + 2 empty directories)

### Step 1.1: Delete old command
- `packages/cli/src/private/commands/create/index.ts`

### Step 1.2: Delete old orchestrator + spec
- `packages/cli/src/private/utils/create/create-powerup.ts`
- `packages/cli/src/private/utils/create/create-powerup.spec.ts` (all tests already commented out)

### Step 1.3: Delete old get-package-deps
- `packages/cli/src/private/utils/create/get-package-deps.ts`

### Step 1.4: Delete old git directory (4 files)
- `packages/cli/src/private/utils/create/git/git-status.ts`
- `packages/cli/src/private/utils/create/git/git-status.spec.ts`
- `packages/cli/src/private/utils/create/git/diff-to-modifications.ts`
- `packages/cli/src/private/utils/create/git/diff-to-modifications.spec.ts`
- Remove empty `git/` directory

### Step 1.5: Delete old steps directory (7 files)
- `packages/cli/src/private/utils/create/steps/index.ts`
- `packages/cli/src/private/utils/create/steps/generate-step-name.ts`
- `packages/cli/src/private/utils/create/steps/wrap-as-template.ts`
- `packages/cli/src/private/utils/create/steps/create-step-from-new-file.ts`
- `packages/cli/src/private/utils/create/steps/create-step-from-modified-file.ts`
- `packages/cli/src/private/utils/create/steps/create-step-from-deleted-file.ts`
- `packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts`
- Remove empty `steps/` directory

## Phase 2: Update CLI entry point

### Step 2.1: Update `packages/cli/src/commands/create.ts`
Change import from old to new:
```ts
import create from "../private/commands/create/create-new.js";
```

## Phase 3: Update doctor.spec.ts

### Step 3.1: Update doctor.spec.ts to not use old create command

The `doctor.spec.ts` currently uses `create.run()` with `--pack` and `--type` flags to scaffold test powerups. The new create command doesn't support `--pack` and dogfoods `runPowerup` which requires `create-powerup` to be installed.

**Approach:** Replace `create.run()` calls with manual file creation. The doctor spec only needs powerup directories with `instructions.json` files — it doesn't need the full create command flow. For each `create.run()` call, replace with direct `instructions.json` + `package.json` creation in the appropriate folder.

Remove the import:
```ts
import create from "#commands/create/index";
```

For each test case that calls `create.run()`, replace with a helper function that creates the powerup directory structure manually:
- Create `internal/test-pkg/multi-use/<name>/` directory
- Write `instructions.json` with the needed step definitions
- Write `package.json` with powerup metadata

The doctor tests don't actually run the powerups — they just validate their structure. So manual creation is sufficient and more direct.

## Phase 4: Verify and commit

### Step 4.1: Type check
```
npx tsc --noEmit
```
Should see the 5 errors from old files referencing removed error codes disappear (down from 26 to ~21).

### Step 4.2: Run all new create specs
```
npx proby src/private/commands/create/create.spec.ts
npx proby src/private/errors/createErrors.spec.ts
npx proby src/private/utils/create/check-for-pre-create-errors/index.spec.ts
npx proby src/private/utils/create/build-variables.spec.ts
npx proby src/private/utils/create/capture-files/wrap-as-template.spec.ts
npx proby src/private/utils/create/capture-files/generate-step-name.spec.ts
npx proby src/private/utils/create/capture-files/git-status.spec.ts
npx proby src/private/utils/create/capture-files/diff-to-modifications.spec.ts
npx proby src/private/utils/create/capture-files/capture-all-files.spec.ts
npx proby src/private/utils/create/capture-files/capture-working-dir.spec.ts
npx proby src/private/utils/create/capture-files/add-steps-to-index.spec.ts
npx proby src/private/utils/create/register-powerup.spec.ts
```

### Step 4.3: Run doctor spec
```
npx proby src/private/commands/doctor/doctor.spec.ts
```

### Step 4.4: Run existing use specs to confirm no regressions
```
npx proby src/private/utils/use/run-powerup/run-powerup.spec.ts
npx proby src/private/utils/use/run-powerup/run-step.spec.ts
npx proby src/private/commands/use/use.spec.ts
```

### Step 4.5: Commit
```
git add -A
git commit -m "refactor: remove old create command and utilities

- Delete old create command (commands/create/index.ts)
- Delete old create-powerup orchestrator + spec
- Delete old get-package-deps utility
- Delete old git/ directory (git-status, diff-to-modifications)
- Delete old steps/ directory (7 step files)
- Update CLI entry point to use create-new.ts
- Update doctor.spec.ts to manually create test powerups
  instead of using the old create command
- 15 files removed, 2 files updated"
```

## Summary

| Action | Count |
|--------|--------|
| Files to delete | 15 |
| Directories to remove | 2 (`git/`, `steps/`) |
| Files to update | 2 (`commands/create.ts`, `doctor.spec.ts`) |
| Total phases | 4 |