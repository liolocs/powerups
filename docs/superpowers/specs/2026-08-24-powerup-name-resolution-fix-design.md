# Powerup Name Resolution Fix — 2026-08-24

## Problem

When a powerup is installed via git or npm (e.g., `install git:github.com/liolocs/powerup-hello-world`), the user cannot use it by its powerup name (`use powerup-hello-world`). Two root causes:

1. **Config matching fails**: `getPowerupInstallFromConfig` matches by `getPackageSource(pkg).split(":")[1] === powerupName`. For internal powerups (`internal:my-powerup`), this gives `"my-powerup"` — correct. For git (`git:github.com/liolocs/powerup-hello-world`), it gives `"github.com/liolocs/powerup-hello-world"` — wrong. For npm (`npm:@liolocs/powerup-hello-world`), it gives `"@liolocs/powerup-hello-world"` — wrong.

2. **Path resolution is wrong**: `getPowerup` constructs the directory path using the user-typed `powerupName`, not the source. For npm: `node_modules/powerup-hello-world` (actual: `node_modules/@liolocs/powerup-hello-world`). For git: `powerup-hello-world` (actual: `github.com/liolocs/powerup-hello-world`).

## Solution

Store the powerup's actual name (from `dist/instructions.json`) in the config at install time. Use the source string (not the powerup name) for path resolution via `parseSource`.

## Changes

### 1. SDK schema: extend `PackageEntry` with optional `name` field

**File**: `packages/sdk/src/private/schema/config.ts`

Add `name?: string` to the object form of `packageEntrySchema`:

```ts
const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    name: zod.string().optional(),
    powerups: zod.object({
      include: zod.array(zod.string()).optional(),
      exclude: zod.array(zod.string()).optional(),
    }).optional(),
  }),
]);
```

The `powerups` field stays for now (removing it is a separate cleanup). The `name` field is optional so plain string entries and existing object entries without `name` continue to parse.

### 2. CLI config types: update `PackageEntry` and `NormalizedPackageEntry`

**File**: `packages/cli/src/private/utils/config.ts`

Update the local `PackageEntry` type to include `name`:

```ts
export type PackageEntry = string | {
  package: string;
  name?: string;
  powerups?: {
    include?: string[];
    exclude?: string[];
  };
};

export type NormalizedPackageEntry = {
  package: string;
  name?: string;
  powerups?: {
    include?: string[];
    exclude?: string[];
  };
};
```

Update `normalizePackageEntry` to copy `name` when present.

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

### 4. Install command: read powerup name from `dist/instructions.json`, pass to `registerPowerup`

**File**: `packages/cli/src/private/commands/install/index.ts`

After `validateInstalledPackage` succeeds, read the powerup name from `dist/instructions.json`:

```ts
const instructions = await powerupDir
  .append(`/${parsedSource.storePath}/dist/instructions.json`)
  .json() as { name: string };

await registerPowerup({
  configEntry: parsedSource.configEntry,
  powerupName: instructions.name,
  isLocal,
  projectRoot,
  homeDir,
});
```

**Dry-run handling**: In dry-run mode, we skip fetching and validation, so we can't read the powerup name. This is fine — dry-run doesn't register anything anyway. The `registerPowerup` call only happens inside the `if (!isDryRun)` block.

### 5. `registerPowerup`: accept optional `powerupName`, store object entries for npm/git

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

### 6. `getPowerupInstallFromConfig`: match by `name` field, return `source`

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

Where `matchesPowerupName` handles both entry forms:

```ts
function matchesPowerupName(entry: PackageEntry, powerupName: string): boolean {
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
Object entries without `name` (legacy): match by `split(":")[1]` — backward compat.

Return type changes from `{ where: "internal" | "npm" | "git" }` to `{ source: string }`. The `determineInstallationType` function is removed — no longer needed since `parseSource` handles type detection.

### 7. `getPowerup`: use `parseSource(source).storePath` for path resolution

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

### 8. `getIsPowerupInConfig`: match by `name` field for object entries

**File**: `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts`

Update to match by `name` field for object entries:

```ts
export default function getIsPowerupInConfig({
  config, powerupName,
}: {
  config: PowerupConfig; powerupName?: string;
}): boolean {
  if (is.falsy(powerupName)) {
    return false;
  }

  return config.packages.some(p => {
    if (typeof p === "string") {
      return p === powerupName || p.split(":")[1] === powerupName;
    }
    if (p.name !== undefined) {
      return p.name === powerupName;
    }
    return p.package === powerupName || p.package.split(":")[1] === powerupName;
  });
}
```

### 9. Update affected test files

**Files**:
- `packages/cli/src/private/utils/install/parse-source/index.spec.ts` — update internal `storePath` assertion to `installed/_internal/my-powerup`
- `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts` — update return type from `{ where }` to `{ source }`, add npm/git object entry test cases
- `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.spec.ts` — add test cases for object entries with `name` field
- `packages/cli/src/private/utils/shared/register-powerup.spec.ts` — update to test `powerupName` parameter for npm/git entries
- `packages/cli/src/private/commands/install/install.spec.ts` — update config assertions to expect object entries for npm/git
- `packages/cli/src/private/commands/create/create.spec.ts` — config assertions for internal entries remain strings (no change expected)

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
  → registerPowerup({ configEntry: "git:github.com/liolocs/powerup-hello-world",
                      powerupName: "powerup-hello-world", ... })
  → config.json stores: { "package": "git:github.com/liolocs/powerup-hello-world",
                           "name": "powerup-hello-world" }
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
| `packages/sdk/src/private/schema/config.ts` | Add `name?: string` to object form of `packageEntrySchema` |
| `packages/cli/src/private/utils/config.ts` | Add `name?` to `PackageEntry` + `NormalizedPackageEntry` types, update `normalizePackageEntry` |
| `packages/cli/src/private/utils/install/parse-source/index.ts` | Fix internal `storePath` to include `INSTALLED_FOLDER.internal` prefix |
| `packages/cli/src/private/commands/install/index.ts` | Read powerup name from `dist/instructions.json`, pass `powerupName` to `registerPowerup` |
| `packages/cli/src/private/utils/shared/register-powerup.ts` | Accept optional `powerupName`, store object entries when provided |
| `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts` | Match by `name` field, return `{ source }` instead of `{ where }`, remove `determineInstallationType` |
| `packages/cli/src/private/utils/use/get-powerup/getPowerup.ts` | Use `parseSource(source).storePath` for path, remove manual `INSTALLED_FOLDER` path construction |
| `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts` | Match by `name` field for object entries |
| 6 spec files | Update assertions for new return types and object config entries |