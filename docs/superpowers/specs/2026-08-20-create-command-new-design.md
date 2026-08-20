# New `create` Command Design

## Overview

The new `create` command (`create-new.ts`) scaffolds a new powerup by running the internal `create-powerup` powerup through the same `runPowerup` pipeline that `use` uses — dogfooding our own product. It follows the new coding principles introduced in `build` and `use`: SDK schemas, focused modules, descriptive naming, clean error handling.

After the skeleton is created, optional `--capture` post-processing reads files from the repo (all files or git-changed files) and generates steps + templates inside the new powerup.

## Architecture

### Why not call `use.run()` directly?

The `use` command's action function has constraints incompatible with `create`:

1. **Clean git state check** — `use` throws `working_tree_dirty` on uncommitted changes. But `capture=workingDir` specifically needs uncommitted changes.
2. **Hardcoded destination** — `use` always passes `destination: root` (project root). Create needs global root for global powerups.
3. **Flag name mismatch** — `extractVariables` normalizes `--variables` → `variables`, but create-powerup expects `requiredVariables`. Same for `--type` → `type` vs `powerupType`.
4. **EXCLUDE_FLAGS** — `use` doesn't exclude `--capture` or `--local`, so they'd be extracted as variables.

Instead, the create command **reuses the individual utilities** from `utils/use/` (`getPowerup`, `checkCompiledInstructionsForErrors`, `runPowerup`) and builds its own thin orchestrator with create-specific validation and post-processing.

### Flow

```
1. Parse flags & subcommand
2. Pre-create validation
3. Get the create-powerup internal powerup (getPowerup)
4. Validate create-powerup instructions (checkCompiledInstructionsForErrors)
5. Build variables (manual mapping, not extractVariables)
6. Call runPowerup → creates skeleton (index.ts, package.json, tsconfig.json, .gitignore)
7. Capture post-processing (if --capture is set)
8. Register the new powerup in config.json
9. Print summary
```

## Flags

| Flag | Short | Maps to create-powerup variable | Required | Default |
|------|-------|----------------------------------|----------|---------|
| `--capture` | `-c` | (create command only) | No | — |
| `--dry-run` | `-dr` | (controls runPowerup isDryRun) | No | — |
| `--local` | `-l` | (determines outputPath + registration target) | No | — |
| `--description` | `-d` | `description` | Yes | — |
| `--intent` | `-i` | `intent` | No | `""` |
| `--variables` | `-v` | `requiredVariables` | No | `""` |
| `--optional-variables` | `-ov` | `optionalVariables` | No | `""` |
| `--type` | `-t` | `powerupType` | No | `"single-use"` |

The `name` variable comes from the subcommand (not a flag).

### `--local` flag

Controls where the new powerup is created and registered:

- **No `--local`** (global, default):
  - `destination` (passed to `runPowerup`) = `GLOBAL_ROOT` (`~/.powerups`)
  - `outputPath` = `installed/_internal` (relative to `destination`)
  - New powerup directory = `~/.powerups/installed/_internal/<name>/`
  - Registration: `addPackageToGlobalConfig("internal:<name>")`

- **With `--local`**:
  - `destination` = project root
  - `outputPath` = `.powerups/installed/_internal` (relative to `destination`)
  - New powerup directory = `<root>/.powerups/installed/_internal/<name>/`
  - Registration: `addPackageToConfig(root, "internal:<name>")`

`outputPath` is always relative to `destination` — `runPowerup`'s create step does
`destination.append(`/${resolvedOutputPath}`)`, so an absolute `outputPath` would
produce a doubled path.

### `--capture` flag

Accepts `"all"` or `"workingDir"`. If an invalid value is passed, error with usage instructions:

```
Invalid --capture value. Must be 'all' or 'workingDir'.
Usage: <cli> create <name> --capture=<all|workingDir>
```

### Variable building

Variables are built manually (not via `extractVariables`) because:
1. `name` comes from the subcommand, not flags
2. `--variables` maps to `requiredVariables` (name mismatch with `extractVariables` normalization)
3. `--type` maps to `powerupType` (name mismatch)
4. `outputPath` is computed from `--local`, not a flag value

The `build-variables.ts` module handles this mapping.

## Pre-Create Validation

`check-for-pre-create-errors/index.ts` runs these checks before anything else:

1. **Name was passed** — subcommand exists and is non-empty
2. **Capture flag valid** — if `--capture` is passed, value must be `"all"` or `"workingDir"`
3. **Description was passed** — `--description` is required by the create-powerup
4. **Powerup doesn't already exist** — target directory (`<destination>/<outputPath>/<name>/`) doesn't exist yet
5. **Folder structure exists** — for local: `.powerups/` folder exists; for global: global root exists

### Error file: `createErrors.ts` (updated)

**Keep**: `missing_name`, `already_exists`, `main_folder_not_found`

**Add**:
- `invalid_capture` — bad `--capture` value with usage instructions
- `missing_description` — `--description` not passed
- `global_root_not_found` — global root doesn't exist (for global mode)

**Remove** (no longer needed):
- `missing_type` — `--type` has a sensible default via create-powerup
- `invalid_package_deps_json` — `--package-deps` flag removed
- `not_a_git_repo` — git repo check handled in capture logic
- `package_not_initialized` — `--pack` flag removed

## Capture Post-Processing

Runs **after** `runPowerup` creates the skeleton. Two modes:

### `capture=all`

Reads every file in the repo, excluding:
- Anything in `.gitignore` files (via `git ls-files --cached --others --exclude-standard`)
- `node_modules/` (everywhere, including inside `.powerups/`)
- `dist/`
- Lock files (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`)
- `.env` files
- The newly created powerup's own directory (to avoid self-referencing)

Does **NOT** exclude `.powerups/` — local powerups may contain files the user needs.

For each file:
- Read content → wrap as template → write to `<newPowerupDir>/templates/`
- Generate a **create step**: `{ type: "create", name, template, outputPath }`
- `outputPath` = file's path relative to project root
- Template path = relative to the powerup directory

### `capture=workingDir`

Recreates the old git-based logic:
- Runs `git status --porcelain --untracked-files=all` in the working directory
- Respects `.gitignore` (git does this natively)
- Excludes `.powerups/` paths and lock files (same as old `git-status.ts`)
- Classifies changes:
  - **New** → create step + template (read file content, wrap as template)
  - **Modified** → modify step + template (generate modifications from `git diff`)
  - **Deleted** → delete step (no template needed)
  - **Renamed/unknown** → warning, skipped

### Both modes: writing steps into `index.ts`

After generating steps + templates:
1. Read the newly created `index.ts`
2. Replace `steps: []` with `steps: <JSON.stringify(capturedSteps, null, 2)>`
3. Write the updated file

### Dry-run behavior

In dry-run mode:
- `runPowerup` doesn't write files (no skeleton created)
- Capture still reads files and generates steps **in memory**
- Prints what it would do (file count, step count)
- Writes nothing — no templates, no `index.ts` modification, no registration

## Registration

After `runPowerup` + capture post-processing:

- **Local**: `addPackageToConfig(root, "internal:<name>")` — adds to local `.powerups/config.json`
- **Global**: `addPackageToGlobalConfig("internal:<name>")` — adds to `~/.powerups/config.json`
- Skipped in dry-run mode

## Create-Powerup Updates

The create-powerup already uses the new SDK schema format. One update needed:

- **`outputPath` default**: Change from `.powerups/_internal` to `.powerups/installed/_internal` — matches `INSTALLED_FOLDER.internal` and is correct for local creation. The create command always passes `outputPath` explicitly, but the default should still be sensible.

Update both `index.ts` (source) and `dist/instructions.json` (compiled).

## Module Structure

```
commands/create/
  create-new.ts                        — orchestrator (the command)
  create.spec.ts                        — command tests (existing, will need updating)

utils/create/
  check-for-pre-create-errors/
    index.ts                            — runs all pre-create checks
    check-name-was-passed.ts
    check-capture-flag-valid.ts
    check-description-was-passed.ts
    check-powerup-does-not-exist.ts
    check-folder-structure-exists.ts
  build-variables.ts                    — maps CLI flags → create-powerup variables
  capture-files/
    index.ts                            — dispatch to "all" or "workingDir"
    capture-all-files.ts                — git ls-files, generate create steps + templates
    capture-working-dir.ts              — git status, generate create/modify/delete steps
    wrap-as-template.ts                  — wrap content as TS template function
    generate-step-name.ts               — unique step names (create-foo, modify-bar)
    git-status.ts                        — porcelain output parsing
    diff-to-modifications.ts            — generate modifications from diff
    add-steps-to-index.ts               — replace steps: [] in index.ts with captured steps
  register-powerup.ts                   — add to local or global config
  print-create-summary.ts               — print results

errors/
  createErrors.ts                       — updated (add/remove errors as specified)

# Reused from utils/use/ (imported, not recreated):
  getPowerup                             — find create-powerup in config
  checkCompiledInstructionsForErrors     — validate instructions
  runPowerup                              — execute the create-powerup steps
```

Old `utils/create/` files (`create-powerup.ts`, `get-package-deps.ts`, `git/`, `steps/`) will be removed after the new code is working.

## `runPowerup` Parameters for Create

When calling `runPowerup`, the create command passes:

- `destination`: `GLOBAL_ROOT` (`~/.powerups`) for global, project root for local
- `powerupDirectory`: create-powerup's location (from `getPowerup`)
- `instructions`: create-powerup's validated compiled instructions
- `isDryRun`: from `--dry-run` flag
- `variables`: built by `build-variables.ts` (name, description, intent, requiredVariables, optionalVariables, powerupType, outputPath)
  - `outputPath` is relative to `destination`: `installed/_internal` (global) or `.powerups/installed/_internal` (local)
- `powerupVersion`: from `getPowerup` result
- `powerupLocation`: from `getPowerup` result

## Old Flags Removed

These flags from the old `create/index.ts` are no longer needed:
- `--working-dir` / `-wd` — replaced by `--capture`
- `--pack` / `-pk` — the create-powerup generates `package.json` with a sensible default
- `--package-deps` / `-p` — `packageDependencies` removed from the new schema