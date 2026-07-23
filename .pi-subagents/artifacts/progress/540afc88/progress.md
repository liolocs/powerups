# Progress: Config & Resolution Changes (Worker 1)

## Status: Complete

## Changes Made

### config.ts
- Removed `harness` from `Config` type → `{ packages: PackageEntry[] }`
- Merged `configSchema` and `globalConfigSchema` into single `configSchema` (no harness field)
- `readConfig` no longer returns `harness` in result
- `readGlobalConfig` now returns `Config | null` (was `{ packages: [] }`) and accepts optional `homeDir?: string` parameter for testability
- `writeGlobalConfig` accepts `Config` (no harness) and optional `homeDir?: string`
- `addPackageToGlobalConfig` handles null from `readGlobalConfig` (coalesces to `{ packages: [] }`) and accepts optional `homeDir`
- Added `import path from "node:path"` for path construction

### config.spec.ts
- Removed all `harness` from test fixtures
- Removed "should read harness from config file" test case
- Updated "should write config file with harness" → "should write config file" (asserts no harness field)
- Updated readGlobalConfig tests: tests return null when file doesn't exist, tests reading packages from global config with homeDir override
- Updated all addPackageToConfig/removePackageFromConfig fixtures to remove harness

### resolve-powerup.ts
- Added `fallbackToGlobal?: boolean` and `homeDir?: string` options to `resolvePowerUp`
- When `fallbackToGlobal` is true and local config exists: merges global packages (deduped by source, local priority)
- When `fallbackToGlobal` is true and no local config: reads global config, throws `power_errors.not_initialized()` if global also missing
- When `fallbackToGlobal` is false (default): behaves as before (local only, throws not_found if no config)
- Added imports: `readGlobalConfig`, `getPackageSource` from config utils

### resolve-powerup.spec.ts
- Removed `harness` parameter from `createConfig` helper
- Added test group "resolvePowerUp with fallbackToGlobal":
  - throws not_initialized when neither local nor global config exists
  - resolves from global config when no local config exists
  - merges local + global config, local takes priority by source
  - without fallbackToGlobal, throws not_found when no local config

### powerErrors.ts
- Added `not_initialized` error: `${CLI_NAME} is not initialized — run "${CLI_CMD} init" first`
- Added `CLI_NAME` to imports

## Tests Run
- `npx proby --include "config.spec.ts,resolve-powerup.spec.ts"` → exit code 0 (passed)