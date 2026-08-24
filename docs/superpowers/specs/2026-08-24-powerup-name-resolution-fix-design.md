# Powerup Name Resolution Fix — 2026-08-24

## Problem

When a powerup is installed via git or npm (e.g., `install git:github.com/liolocs/powerup-hello-world`), the user cannot use it by its powerup name (`use powerup-hello-world`). Two root causes:

1. **Config matching fails**: `getPowerupInstallFromConfig` matches by `getPackageSource(pkg).split(":")[1] === powerupName`. For internal powerups (`internal:my-powerup`), this gives `"my-powerup"` — correct. For git (`git:github.com/liolocs/powerup-hello-world`), it gives `"github.com/liolocs/powerup-hello-world"` — wrong. For npm (`npm:@liolocs/powerup-hello-world`), it gives `"@liolocs/powerup-hello-world"` — wrong.

2. **Path resolution is wrong**: `getPowerup` constructs the directory path using the user-typed `powerupName`, not the source. For npm: `node_modules/powerup-hello-world` (actual: `node_modules/@liolocs/powerup-hello-world`). For git: `powerup-hello-world` (actual: `github.com/liolocs/powerup-hello-world`).

## Solution

Store the powerup's actual name (from `dist/instructions.json`) in the config at install time. Use the source string (not the powerup name) for path resolution via `parseSource`. Prevent installing two powerups with the same name in the same config.

## Changes

### 1. SDK schema: replace `powerups` field with `name` field in `PackageEntry`

**File**: `packages/sdk/src/private/schema/config.ts`

The `powerups.include/exclude` filtering field is dead code (dropped in the install redesign). Replace it with `name`:

```ts
const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    name: zod.string().optional(),
  }),
]);
```

Plain string entries (internal powerups): `"internal:my-powerup"` — unchanged.
Object entries (npm/git powerups): `{ package: "git:github.com/owner/repo", name: "powerup-hello-world" }` — new.
The `name` field is optional so existing object entries without it continue to parse.

### 2. CLI config types: update `PackageEntry` and `NormalizedPackageEntry`

**File**: `packages/cli/src/private/utils/config.ts`

Replace the `powerups` field with `name`:

```ts
export type PackageEntry = string | {
  package: string;
  name?: string;
};

export type NormalizedPackageEntry = {
  package: string;
  name?: string;
};
```

Update `normalizePackageEntry` to copy `name` when present (remove the `powerups` copy logic).

### 3. `parseSource`: fix internal `storePath` to include `INSTALLED_FOLDER.internal` prefix

**File**: `packages/cli/src/private/utils/install/parse-source/index.ts`

Currently internal returns `storePath: source` (just the bare name). Change to:

```ts
return {
  type: "internal",
  configEntry: source,
  storePath: `${INSTALLED_FOLDER.internal}/${source}`,
};
```

This makes all `storePath` values uniformly relative to `.powerups/`:
- internal: `installed/_internal/my-powerup`
- npm: `installed/npm/node_modules/@liolocs/pkg`
- git: `installed/git/github.com/owner/repo`

### 4. Install command: read powerup name, check for duplicates, pass to `registerPowerup`

**File**: `packages/cli/src/private/commands/install/index.ts`

After `validateInstalledPackage` succeeds, read the powerup name from `dist/instructions.json`, check it's not already installed, then register:

```ts
const packageDir = powerupDir.append(`/${parsedSource.storePath}`);
const instructions = await packageDir.append("/dist/instructions.json").json() as { name: string };

await checkPowerupNameNotAlreadyInstalled({
  powerupName: instructions.name,
  isLocal,
  projectRoot,
  homeDir,
});

await registerPowerup({
  configEntry: parsedSource.configEntry,
  powerupName: instructions.name,
  isLocal,
  projectRoot,
  homeDir,
});
```

**Dry-run handling**: In dry-run mode, we skip fetching and validation, so we can't read the powerup name. This is fine — dry-run doesn't register anything anyway. Both the duplicate check and `registerPowerup` call only happen inside the `if (!isDryRun)` block.

### 5. New error: `already_installed`

**File**: `packages/cli/src/private/errors/installErrors.ts`

Add a new error code:

```ts
already_installed: (name: string) => {
  const errorText =
    `A powerup named "${name}" is already installed.\n` +
    `Use "${CLI_CMD} use ${name}" to use it, or uninstall it first.`;
  return t`${errorBGText}${errorText}`;
},
```

Update `installErrors.spec.ts` with a test case for this error.

### 6. New check: `checkPowerupNameNotAlreadyInstalled`

**File**: `packages/cli/src/private/utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed.ts`

Reads the target config (local or global based on `isLocal`) and checks if any existing entry has the same powerup name:

```ts
export default async function checkPowerupNameNotAlreadyInstalled({
  powerupName,
  isLocal,
  projectRoot,
  homeDir,
}: {
  powerupName: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  const config = isLocal
    ? await readConfig(projectRoot)
    : await readGlobalConfig(homeDir);

  if (config === null) return;

  const alreadyInstalled = config.packages.some(entry =>
    matchesPowerupName(entry, powerupName),
  );

  if (alreadyInstalled) {
    throw install_errors.already_installed(powerupName);
  }
}
```

Uses the same `matchesPowerupName` helper as `getPowerupInstallFromConfig` (see Section 7). This helper should be extracted to a shared location (see Section 10).

### 7. `getPowerupInstallFromConfig`: match by `name` field, return `source`

**File**: `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts`

Replace the matching logic:

```ts
export default async function getPowerupInstallFromConfig({
  powerupName,
  configRef,
}: {
  powerupName: string;
  configRef: FileRef;
}): Promise<{ source: string }> {
  const config = await getConfig(configRef);

  const found = config.packages.find(pkg =>
    matchesPowerupName(pkg, powerupName),
  );

  if (is.falsy(found)) {
    throw use_errors.not_in_config(powerupName);
  }

  return { source: getPackageSource(found!) };
}
```

Return type changes from `{ where: "internal" | "npm" | "git" }` to `{ source: string }`. The `determineInstallationType` function is removed — no longer needed since `parseSource` handles type detection.

### 8. Shared `matchesPowerupName` helper

**File**: `packages/cli/src/private/utils/shared/matches-powerup-name.ts`

Extracted to a shared location since both `getPowerupInstallFromConfig` (use flow) and `checkPowerupNameNotAlreadyInstalled` (install flow) need the same matching logic:

```ts
import type { PackageEntry } from "@liolocs/powerups-sdk";

export default function matchesPowerupName(
  entry: PackageEntry,
  powerupName: string,
): boolean {
  if (typeof entry === "string") {
    return entry.split(":")[1] === powerupName;
  }
  if (entry.name !== undefined) {
    return entry.name === powerupName;
  }
  return entry.package.split(":")[1] === powerupName;
}
```

String entries (internal): match by `split(":")[1]` — unchanged.
Object entries with `name` (npm/git): match by `name` field — new.
Object entries without `name` (legacy): match by `split(":")[1]` on the `package` field — backward compat.

### 9. `getPowerup`: use `parseSource(source).storePath` for path resolution

**File**: `packages/cli/src/private/utils/use/get-powerup/getPowerup.ts`

Replace the manual path construction:

```ts
if (is.defined(localConfig)) {
  const parsedSource = parseSource(localConfig.source);
  const powerupDir = cwd.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`);
  return fetchPowerup({ powerupDir, powerupName });
} else if (is.defined(globalConfig)) {
  const parsedSource = parseSource(globalConfig.source);
  const powerupDir = globalPowerupsDir.append(`/${parsedSource.storePath}`);
  return fetchPowerup({ powerupDir, powerupName });
}
```

The `INSTALLED_FOLDER` import is no longer needed (store paths come from `parseSource`). Add import for `parseSource`.

### 10. `getIsPowerupInConfig`: use shared `matchesPowerupName` helper

**File**: `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts`

Replace the inline matching with the shared helper:

```ts
import matchesPowerupName from "#utils/shared/matches-powerup-name";

export default function getIsPowerupInConfig({
  config, powerupName,
}: {
  config: PowerupConfig; powerupName?: string;
}): boolean {
  if (is.falsy(powerupName)) {
    return false;
  }

  return config.packages.some(p => matchesPowerupName(p, powerupName));
}
```

This simplifies the function and ensures matching logic is consistent everywhere. Note: the old code also checked `source === powerupName` (exact match on the full source string), but that was for bare names like `"test-powerup"` without a prefix. With the new `matchesPowerupName`, `"test-powerup".split(":")[1]` gives `undefined` which won't match — but this case only existed in tests, not real usage. Real entries always have a prefix (`internal:`, `npm:`, `git:`) or a `name` field.

### 11. `registerPowerup`: accept optional `powerupName`, store object entries for npm/git

**File**: `packages/cli/src/private/utils/shared/register-powerup.ts`

Change the signature to accept an optional `powerupName`:

```ts
export default async function registerPowerup({
  configEntry,
  powerupName,
  isLocal,
  projectRoot,
  homeDir,
}: {
  configEntry: string;
  powerupName?: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  const entry = powerupName !== undefined
    ? { package: configEntry, name: powerupName }
    : configEntry;

  if (isLocal) {
    await addPackageToConfig(projectRoot, entry);
  } else {
    await addPackageToGlobalConfig(entry, homeDir);
  }
}
```

When `powerupName` is provided (npm/git installs), store as object `{ package, name }`. When not (create command for internal powerups), store as plain string. The create command calls `registerPowerup({ configEntry: \`internal:${powerupName}\` })` without `powerupName`, so it stores a string — unchanged.

### 12. Update affected test files

**Files**:
- `packages/cli/src/private/utils/config.spec.ts` — update `normalizePackageEntry` and `getPackageSource` tests: replace `powerups` field with `name` field in object entry test cases
- `packages/cli/src/private/utils/install/parse-source/index.spec.ts` — update internal `storePath` assertion to `installed/_internal/my-powerup`
- `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts` — update return type from `{ where }` to `{ source }`, add npm/git object entry test cases
- `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.spec.ts` — add test cases for object entries with `name` field
- `packages/cli/src/private/utils/shared/register-powerup.spec.ts` — update to test `powerupName` parameter for npm/git entries
- `packages/cli/src/private/commands/install/install.spec.ts` — update config assertions to expect object entries for npm/git, add duplicate name test case
- `packages/cli/src/private/commands/create/create.spec.ts` — config assertions for internal entries remain strings (no change expected)
- `packages/cli/src/private/errors/installErrors.spec.ts` — add `already_installed` error test case

## Data Flow

### Install (git example)

```
install git:github.com/liolocs/powerup-hello-world
  → parseSource("git:github.com/liolocs/powerup-hello-world")
  → { type: "git", configEntry: "git:github.com/liolocs/powerup-hello-world",
      storePath: "installed/git/github.com/liolocs/powerup-hello-world",
      cloneUrl: "https://github.com/liolocs/powerup-hello-world" }

  → fetchPackage → clone to installed/git/github.com/liolocs/powerup-hello-world/
  → validateInstalledPackage → checks keyword + dist/instructions.json
  → read dist/instructions.json → { name: "powerup-hello-world", ... }
  → checkPowerupNameNotAlreadyInstalled → reads config, no match found ✓
  → registerPowerup({ configEntry: "git:github.com/liolocs/powerup-hello-world",
                      powerupName: "powerup-hello-world", ... })
  → config.json stores: { "package": "git:github.com/liolocs/powerup-hello-world",
                           "name": "powerup-hello-world" }
```

### Install with duplicate name (blocked)

```
install npm:@liolocs/powerup-hello-world  (when git version already installed)
  → parseSource → fetchPackage → validateInstalledPackage
  → read dist/instructions.json → { name: "powerup-hello-world", ... }
  → checkPowerupNameNotAlreadyInstalled → reads config
  → finds { package: "git:github.com/liolocs/powerup-hello-world",
             name: "powerup-hello-world" }
  → matches by name field → throws already_installed("powerup-hello-world")
  → package files are left in store (orphaned, not registered)
```

### Use (by powerup name)

```
use powerup-hello-world
  → getPowerup({ name: "powerup-hello-world", ... })
  → getPowerupInstallFromConfig({ powerupName: "powerup-hello-world", ... })
  → finds { package: "git:github.com/liolocs/powerup-hello-world",
             name: "powerup-hello-world" }
  → matches by name field → returns { source: "git:github.com/liolocs/powerup-hello-world" }
  → parseSource("git:github.com/liolocs/powerup-hello-world")
  → storePath: "installed/git/github.com/liolocs/powerup-hello-world"
  → powerupDir = root.append("/.powerups/installed/git/github.com/liolocs/powerup-hello-world")
  → fetchPowerup reads dist/instructions.json + package.json ✓
```

## Files Changed

| File | Change |
|------|--------|
| `packages/sdk/src/private/schema/config.ts` | Replace `powerups` field with `name?: string` in object form |
| `packages/cli/src/private/utils/config.ts` | Replace `powerups` with `name?` in types, update `normalizePackageEntry` |
| `packages/cli/src/private/utils/install/parse-source/index.ts` | Fix internal `storePath` to include `INSTALLED_FOLDER.internal` prefix |
| `packages/cli/src/private/errors/installErrors.ts` | Add `already_installed` error |
| `packages/cli/src/private/utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed.ts` | New file — duplicate name check |
| `packages/cli/src/private/utils/shared/matches-powerup-name.ts` | New file — shared matching helper |
| `packages/cli/src/private/commands/install/index.ts` | Read powerup name, check duplicates, pass `powerupName` to `registerPowerup` |
| `packages/cli/src/private/utils/shared/register-powerup.ts` | Accept optional `powerupName`, store object entries when provided |
| `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts` | Match by `name` field via shared helper, return `{ source }` instead of `{ where }` |
| `packages/cli/src/private/utils/use/get-powerup/getPowerup.ts` | Use `parseSource(source).storePath` for path, remove manual `INSTALLED_FOLDER` path construction |
| `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts` | Use shared `matchesPowerupName` helper |
| 8 spec files | Update assertions for new return types, object config entries, duplicate name tests, and `powerups` → `name` field replacement |