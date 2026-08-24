# Uninstall Command Design

## Purpose

Reverse the install flow: given a powerup name, find it in config, remove the config entry, and clean up the installed files from disk.

## Command

```
pup uninstall <powerup-name> [--local] [--dry-run]
```

- Without `--local`: targets global config (`~/.powerups/config.json`)
- With `--local`: targets local config (`.powerups/config.json`)
- With `--dry-run`: prints what would be removed, skips all mutations

Internal powerups (`internal:*` entries) cannot be uninstalled — they are created, not installed. The command throws `internal_not_uninstallable` if the resolved entry is internal.

## Flow

1. Check powerup name was passed as subcommand → `missing_name` if not
2. Determine target config ref (local or global based on `--local`)
3. `findPowerupInConfig({ configRef, powerupName })` → `PackageEntry | null`
4. If null → `not_installed` error
5. Extract source via `getPackageSource(entry)`, run `parseSource(source)` → type + storePath
6. If `type === "internal"` → `internal_not_uninstallable` error
7. If `--dry-run` → print summary of what would be removed, return
8. Remove config entry: `removePackageFromConfig` (local) or `removePackageFromGlobalConfig` (global)
9. Remove install directory:
   - **npm**: run `npm uninstall <package-name>` in the `installed/npm/` directory (cleans `node_modules/` + `package.json` dependencies)
   - **git**: `FileRef.remove()` on the cloned directory
10. Print uninstall summary

## Components

### 1. Shared helper: `utils/shared/find-powerup-in-config.ts`

Extracted from `getPowerupInstallFromConfig`. Reads config via `getConfig`, searches entries with `matchesPowerupName`, returns the full `PackageEntry | null` without throwing.

```ts
export default async function findPowerupInConfig({
  configRef,
  powerupName,
}: {
  configRef: FileRef;
  powerupName: string;
}): Promise<PackageEntry | null>
```

### 2. Refactor: `getPowerupInstallFromConfig`

Uses `findPowerupInConfig` internally. If null → throws `use_errors.not_in_config`. Otherwise returns `{ source: getPackageSource(entry) }`. Same external behavior, delegates the lookup to the shared helper.

### 3. Config util: `removePackageFromGlobalConfig` in `config.ts`

New function mirroring `removePackageFromConfig` but for global config. Accepts optional `homeDir` for testability.

```ts
export async function removePackageFromGlobalConfig(
  source: string,
  homeDir?: string,
): Promise<void>
```

Reads global config, filters out the entry matching the source, writes back. Does nothing if the global config doesn't exist.

### 4. Error file: `errors/uninstallErrors.ts`

Three error codes following the `installErrors.ts` pattern:

- `missing_name` — no powerup name passed as subcommand
- `not_installed` — powerup not found in target config
- `internal_not_uninstallable` — found in config but resolved to internal type

### 5. Pre-uninstall checks: `utils/uninstall/check-for-pre-uninstall-errors/`

- `check-name-was-passed.ts` — throws `missing_name` if no subcommand
- `check-not-internal.ts` — throws `internal_not_uninstallable` if `parsedSource.type === "internal"`
- `index.ts` — orchestrator calling both

### 6. Remove install directory: `utils/uninstall/remove-install-directory.ts`

Handles two cleanup paths based on parsed source type:

- **npm**: run `npm uninstall <packageName>` via `io.run` in the npm store directory (`installed/npm/`). This cleans both `node_modules/` and `package.json` dependencies in one step.
- **git**: `FileRef.remove()` on the store directory (e.g., `installed/git/github.com/owner/repo/`)

Skipped entirely in dry-run. Silently succeeds if the directory doesn't exist (config removal already happened at this point).

### 7. Print summary: `utils/uninstall/print-uninstall-summary.ts`

Prints powerup name, source, install type, removed directory path, and dry-run indicator. Mirrors `printInstallSummary` structure.

### 8. Command: `commands/uninstall/index.ts`

Wires the flow together with `--local` and `--dry-run` boolean flags using the `as const satisfies Flag` pattern from install.

Flag definitions:
- `dryRunFlag`: `{ name: "dryRun", long: "dry-run", short: "dr", type: "boolean" }`
- `localFlag`: `{ name: "local", long: "local", short: "l", type: "boolean" }`

### 9. Command registration

Add `uninstall` to `commands/index.ts`.

## Error Handling

- **Missing name**: `missing_name` — thrown before any config reads. Same pattern as install's `missing_source`.
- **Not in config**: `not_installed` — the powerup name doesn't match any entry in the target config. Message mentions uninstall specifically.
- **Internal powerup**: `internal_not_uninstallable` — found in config but resolved to `internal:` type. Message explains internal powerups are created, not installed.
- **Directory already gone**: Not an error. Config removal proceeds, directory removal silently skips.
- **npm uninstall failure**: Caught and rethrown as a generic error with the npm output. Non-fatal for config removal (config entry already removed at this point).

## Testing

Following the install command's test patterns. All tests use `#test-utils/test/index`, `setupTestDir()`/`cleanup()`, descriptive `"should ..."` names, and real file system operations.

- **`uninstallErrors.spec.ts`** — verify error codes and message formatting
- **`check-for-pre-uninstall-errors/index.spec.ts`** — `missing_name` throw, `internal_not_uninstallable` throw, valid name passes
- **`find-powerup-in-config.spec.ts`** — returns entry when found, returns null when not found, matches by name for string/object entries
- **`getPowerupInstallFromConfig.spec.ts`** (updated) — verify refactored version still throws `not_in_config` when null, returns `{ source }` when found
- **`remove-install-directory.spec.ts`** — git directory removal, git missing directory (no error), npm uninstall command execution
- **`print-uninstall-summary.spec.ts`** — dry-run vs real output formatting
- **`uninstall.spec.ts`** (integration) — full flow: uninstall npm powerup from global config, uninstall git powerup from local config, dry-run prints without mutating, `not_installed` when name not in config, `internal_not_uninstallable` for internal entries, `missing_name` when no subcommand