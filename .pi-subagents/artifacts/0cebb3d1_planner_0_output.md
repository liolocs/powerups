# Implementation Plan: Powerup Name Resolution Fix

## Overview

Fix two bugs preventing `use <name>` from working with git/npm-installed powerups, plus add duplicate name prevention during install. The fix stores the powerup's actual name (from `dist/instructions.json`) in config entries as object `{ package, name }`, uses `parseSource` for path resolution in `getPowerup`, and prevents installing two powerups with the same name.

**Spec**: `docs/superpowers/specs/2026-08-24-powerup-name-resolution-fix-design.md`

## Critical Implementation Note (not in spec)

The spec's Section 3 says to change internal `storePath` to `${INSTALLED_FOLDER.internal}/${source}`, but this is incorrect when `source` includes the `internal:` prefix (e.g., `"internal:test-powerup"` would produce `"installed/_internal/internal:test-powerup"`). The internal case must strip the `internal:` prefix:

```ts
const internalName = source.startsWith("internal:")
  ? source.slice("internal:".length)
  : source;
return {
  type: "internal",
  configEntry: source,
  storePath: `${INSTALLED_FOLDER.internal}/${internalName}`,
};
```

This handles both `"internal:my-powerup"` (from config) and `"my-powerup"` (bare name, from install command — though install blocks internal sources before reaching `parseSource`).

## Phases

### Phase 1: SDK Schema — Replace `powerups` with `name` field

**File**: `packages/sdk/src/private/schema/config.ts`

Replace the `powerups` object field with `name?: string`:

```ts
const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    name: zod.string().optional(),
  }),
]);
```

**No test file** — the SDK schema is tested implicitly through CLI tests.

**Verify**: `cd packages/cli && npx tsc --noEmit` — check for type errors from removed `powerups` field.

---

### Phase 2: CLI Config Types — Update `PackageEntry` and helpers

**File**: `packages/cli/src/private/utils/config.ts`

1. Update `PackageEntry` type: replace `powerups?` with `name?: string`
2. Update `NormalizedPackageEntry` type: replace `powerups?` with `name?: string`
3. Update `normalizePackageEntry`: copy `name` when present instead of `powerups`
4. Update JSDoc comment on `PackageEntry` (remove mention of `powerups.include/exclude`)

**File**: `packages/cli/src/private/utils/config.spec.ts`

Update tests that reference `powerups`:
- `"should read packages array with object entries from config file"` — change `powerups: { include: ["a"] }` to `name: "test-powerup"`
- `normalizePackageEntry` group:
  - `"passes through an object entry with a shallow powerups copy"` → rename to `"passes through an object entry with name"` and use `name: "test-powerup"` instead of `powerups: {...}`
  - `"normalizes an object without powerups"` → rename to `"normalizes an object without name"` — assertion stays `{ package: "npm:pkg" }` (name is optional, so its absence means it's not in the result)
- `getPackageSource` group:
  - `"returns .package for an object entry"` — change `powerups: { include: ["a"] }` to `name: "test"`
- `addPackageToConfig` group:
  - `"adds an object entry with a powerups filter"` → rename to `"adds an object entry with name"` and use `name: "test-powerup"` instead of `powerups: { include: ["a"] }`
  - `"updates an existing entry with the same source (dedup)"` — change `powerups: { include: ["a"] }` to `name: "test-powerup"`
- `removePackageFromConfig` group:
  - `"removes an object entry by matching source"` — change `powerups: { include: ["a"] }` to `name: "test-powerup"`

**Note**: `config.spec.ts` uses `import test from "@rcompat/test"` and `test.group()` — this is the OLD test file that was not migrated. Do NOT change the import style. Just update the test data.

**Verify**: `npx proby src/private/utils/config.spec.ts`

---

### Phase 3: Shared `matchesPowerupName` Helper — New file

**File**: `packages/cli/src/private/utils/shared/matches-powerup-name.ts` (NEW)

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

No separate spec — this function is tested through `getPowerupInstallFromConfig.spec.ts` and `getIsPowerupInConfig.spec.ts`.

**Verify**: `npx tsc --noEmit` — type check passes.

---

### Phase 4: `parseSource` — Fix internal `storePath`

**File**: `packages/cli/src/private/utils/install/parse-source/index.ts`

Change the internal return block (last `return` in the function):

```ts
const internalName = source.startsWith("internal:")
  ? source.slice("internal:".length)
  : source;
return {
  type: "internal",
  configEntry: source,
  storePath: `${INSTALLED_FOLDER.internal}/${internalName}`,
};
```

**File**: `packages/cli/src/private/utils/install/parse-source/index.spec.ts`

Update the bare name test case:

```
test.case("should parse a bare name as internal type", async assert => {
  const result = parseSource("my-powerup");

  assert(result.type).equals("internal");
  assert(result.configEntry).equals("my-powerup");
  assert(result.storePath).equals("installed/_internal/my-powerup");  // was "my-powerup"
  assert(result.cloneUrl).undefined();
});
```

Add a new test case for `internal:` prefixed source (since `getPowerup` will pass config entries like `"internal:my-powerup"`):

```
test.case("should parse an internal: prefixed source and strip the prefix from storePath", async assert => {
  const result = parseSource("internal:my-powerup");

  assert(result.type).equals("internal");
  assert(result.configEntry).equals("internal:my-powerup");
  assert(result.storePath).equals("installed/_internal/my-powerup");
  assert(result.cloneUrl).undefined();
});
```

**Verify**: `npx proby src/private/utils/install/parse-source/index.spec.ts`

---

### Phase 5: `already_installed` Error — New error code

**File**: `packages/cli/src/private/errors/installErrors.ts`

Add to the `install_errors` object (after `not_a_powerups_package`):

```ts
already_installed: (name: string) => {
  const errorText =
    `A powerup named "${name}" is already installed.\n` +
    `Use "${CLI_CMD} use ${name}" to use it, or uninstall it first.`;
  return t`${errorBGText}${errorText}`;
},
```

**File**: `packages/cli/src/private/errors/installErrors.spec.ts`

Add test case:

```ts
test.case("should include the powerup name in already_installed error", async assert => {
  try {
    throw install_errors.already_installed("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.already_installed);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup use");
  }
});
```

**Verify**: `npx proby src/private/errors/installErrors.spec.ts`

---

### Phase 6: `checkPowerupNameNotAlreadyInstalled` — New check file

**File**: `packages/cli/src/private/utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed.ts` (NEW)

```ts
import type { FileRef } from "@rcompat/fs";
import { readConfig, readGlobalConfig } from "#utils/config";
import matchesPowerupName from "#utils/shared/matches-powerup-name";
import install_errors from "#errors/installErrors";

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

No separate spec — this is tested through `install.spec.ts` integration tests.

**Verify**: `npx tsc --noEmit` — type check passes.

---

### Phase 7: `getPowerupInstallFromConfig` — Match by name, return source

**File**: `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts`

Replace entire file:

```ts
import use_errors from "#errors/useErrors";
import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
import matchesPowerupName from "#utils/shared/matches-powerup-name";
import is from "@rcompat/is";

function getPackageSource(entry: PackageEntry): string {
  return typeof entry === "string" ? entry : entry.package;
}

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

Remove `determineInstallationType` function entirely. Remove the `where` return type.

**File**: `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts`

Full rewrite needed:

1. `"should give not in config error if powername is not in config"` — keep as-is (uses string entry `"internal:test-powerup"`, searches for `"not-in-config"`)
2. `"should give an invalid config file if the config is invalid"` — keep as-is
3. `"should return an error if the installation type is not supported"` — **DELETE** this test. With the new code, `"random:test-powerup"` matches (split(":")[1] = "test-powerup"), and `{ source: "random:test-powerup" }` is returned without error. The `unsupported_package_type` error is no longer thrown here. (The error becomes a runtime failure at `fetchPowerup` time, which is correct behavior.)
4. `"should return the appropriate installation type for an internal package"` — **REPLACE** with tests for the new return type `{ source }`:

```ts
test.case("should return the source for an internal package", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = { packages: ["internal:test-powerup"] };
  await configRef.writeJSON(config);

  const result = await getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef });
  assert(result.source).equals("internal:test-powerup");

  await cleanup();
});

test.case("should return the source for an npm package with object entry", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: [{ package: "npm:@liolocs/pkg", name: "test-powerup" }],
  };
  await configRef.writeJSON(config);

  const result = await getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef });
  assert(result.source).equals("npm:@liolocs/pkg");

  await cleanup();
});

test.case("should return the source for a git package with object entry", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: [{ package: "git:github.com/owner/repo", name: "test-powerup" }],
  };
  await configRef.writeJSON(config);

  const result = await getPowerupInstallFromConfig({ powerupName: "test-powerup", configRef });
  assert(result.source).equals("git:github.com/owner/repo");

  await cleanup();
});

test.case("should match by name field for object entries", async assert => {
  await setupTestDir();
  const configRef = testRoot.append("/config.json");
  const config: PowerupConfig = {
    packages: [{ package: "git:github.com/owner/repo", name: "my-powerup" }],
  };
  await configRef.writeJSON(config);

  const result = await getPowerupInstallFromConfig({ powerupName: "my-powerup", configRef });
  assert(result.source).equals("git:github.com/owner/repo");

  await cleanup();
});
```

**Verify**: `npx proby src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts`

---

### Phase 8: `getPowerup` — Use `parseSource` for path resolution

**File**: `packages/cli/src/private/utils/use/get-powerup/getPowerup.ts`

Changes:
1. Replace `INSTALLED_FOLDER` import with `parseSource` import
2. Replace the `if (is.defined(localConfig))` block path construction:
   - Old: `const pathSuffix = localConfig.where === "npm" ? ... : powerupName; const powerupDir = cwd.append(.../${INSTALLED_FOLDER[localConfig.where]}/${pathSuffix})`
   - New: `const parsedSource = parseSource(localConfig.source); const powerupDir = cwd.append(\`/${CLI_FOLDER_NAME}/${parsedSource.storePath}\`)`
3. Same for the `globalConfig` branch
4. Keep `CLI_FOLDER_NAME` import (still needed)
5. Remove `INSTALLED_FOLDER` import (no longer needed)

```ts
import { CLI_FOLDER_NAME } from "#constants";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import getPowerupInstallFromConfig from "#utils/use/get-powerup/getPowerupInstallFromConfig";
import parseSource from "#utils/install/parse-source/index";
import is from "@rcompat/is";
import use_errors from "#errors/useErrors";

// ... (rest of getPowerup function signature unchanged)

  // @ts-expect-error it is fine to use before its defined in this case
  if (is.defined(localConfig)) {
    const parsedSource = parseSource(localConfig.source);
    const powerupDir = cwd.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`);

    return fetchPowerup({ powerupDir, powerupName });
    // @ts-expect-error it is fine to use before its defined in this case
  } else if (is.defined(globalConfig)) {
    const parsedSource = parseSource(globalConfig.source);
    const powerupDir = globalPowerupsDir.append(`/${parsedSource.storePath}`);

    return fetchPowerup({ powerupDir, powerupName });
  } else {
    throw use_errors.not_installed(powerupName);
  }
```

**Note**: `getPowerup.spec.ts` should NOT need changes. Test helpers create powerups at `.powerups/installed/_internal/<name>` with config `"internal:<name>"`. After fix: `getPowerupInstallFromConfig` returns `{ source: "internal:<name>" }`, `parseSource("internal:<name>")` returns `storePath: "installed/_internal/<name>"`, `getPowerup` constructs `cwd/.powerups/installed/_internal/<name>` — matches the directory. ✓

**Verify**: `npx proby src/private/utils/use/get-powerup/getPowerup.spec.ts`

---

### Phase 9: `getIsPowerupInConfig` — Use shared `matchesPowerupName`

**File**: `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts`

Replace entire file:

```ts
import { type PowerupConfig } from "@liolocs/powerups-sdk";
import is from "@rcompat/is";
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

**File**: `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.spec.ts`

Update tests:

1. `"should return true if the powerup is in the config"` — currently uses `packages: ["test-powerup"]` (bare string). With `matchesPowerupName`, `"test-powerup".split(":")[1]` = `undefined` ≠ `"test-powerup"`. **MUST CHANGE** to `packages: ["internal:test-powerup"]`.
2. `"should return true if the powerup is in the config with a source prefix"` — uses `packages: ["internal:test-powerup"]` — **no change needed**.
3. `"should return true if the powerup is in the config as a package object"` — uses `packages: [{ package: "internal:test-powerup" }]`. With `matchesPowerupName`, object without `name` falls to `entry.package.split(":")[1]` = `"test-powerup"` ✓. **No change needed**.
4. Add new test: `"should return true if the powerup is in the config as an object with name field"`:
   ```ts
   test.case("should return true if the powerup is in the config as an object with name field", async assert => {
     const config = {
       packages: [{ package: "git:github.com/owner/repo", name: "test-powerup" }],
     };
     const result = getIsPowerupInConfig({ config, powerupName: "test-powerup" });
     assert(result).true();
   });
   ```
5. Tests 4-6 (false cases) — no changes needed (empty packages, empty name, undefined name).

**Verify**: `npx proby src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.spec.ts`

---

### Phase 10: `registerPowerup` — Accept optional `powerupName`

**File**: `packages/cli/src/private/utils/shared/register-powerup.ts`

Add `powerupName?: string` parameter. When provided, store as object `{ package: configEntry, name: powerupName }`. When not, store as plain string.

```ts
import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

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

**File**: `packages/cli/src/private/utils/shared/register-powerup.spec.ts`

Add new test cases for `powerupName` parameter:

```ts
test.case("should store an object entry with name when powerupName is provided for npm", async assert => {
  await setupLocalTestDir();

  await registerPowerup({
    configEntry: "npm:@liolocs/pkg",
    powerupName: "my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  assert(config!.packages[0]).equals({ package: "npm:@liolocs/pkg", name: "my-powerup" });

  await cleanup();
});

test.case("should store an object entry with name when powerupName is provided for git", async assert => {
  await setupLocalTestDir();

  await registerPowerup({
    configEntry: "git:github.com/owner/repo",
    powerupName: "my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  assert(config!.packages[0]).equals({ package: "git:github.com/owner/repo", name: "my-powerup" });

  await cleanup();
});

test.case("should store a plain string entry when powerupName is not provided", async assert => {
  await setupLocalTestDir();

  await registerPowerup({
    configEntry: "internal:my-powerup",
    isLocal: true,
    projectRoot: testRoot,
  });

  const config = await readConfig(testRoot);
  assert(config!.packages[0]).equals("internal:my-powerup");

  await cleanup();
});
```

**Verify**: `npx proby src/private/utils/shared/register-powerup.spec.ts`

---

### Phase 11: Install Command — Read name, check duplicates, pass to register

**File**: `packages/cli/src/private/commands/install/index.ts`

Add imports:
```ts
import checkPowerupNameNotAlreadyInstalled from "#utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed";
```

In the `if (!isDryRun)` block, after `validateInstalledPackage` and before `registerPowerup`, add:

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

**File**: `packages/cli/src/private/commands/install/install.spec.ts`

Update config assertions for npm/git install tests. Currently they check `localConfig.packages.includes(powerupName)` where `powerupName` is the source string. After the fix, config stores object entries. Change assertions:

For npm local test:
```ts
// Old:
assert(localConfig.packages.includes(powerupName)).true();
// New:
assert(localConfig.packages.some((p: any) =>
  p.package === powerupName && p.name === "powerup-hello-world"
)).true();
```

Same pattern for npm global, git local, git global tests.

Add new test case for duplicate name prevention:

```ts
test.case("should throw already_installed when installing a powerup with a name that already exists", async assert => {
  await setupTestDir();
  const { projectDir } = await createSimpleProjectForTest({ projectName: "new-project", testRoot });

  // Pre-populate config with an existing git powerup
  await fs.create(projectDir.append(`/${CLI_FOLDER_NAME}`));
  await fs.write(
    projectDir.append(`/${CLI_FOLDER_NAME}/config.json`),
    JSON.stringify({ packages: [{ package: "git:github.com/owner/repo", name: "powerup-hello-world" }] }) + "\n",
  );

  await assert(install.run({
    subcommands: ["npm:@liolocs/powerup-hello-world"],
    flags: [{ flag: "--local" }],
    context: { root: projectDir },
  })).throwsAsync(InstallErrorCode.already_installed);

  await cleanup();
});
```

**Verify**: `npx proby src/private/commands/install/install.spec.ts`

---

### Phase 12: Type Check and Full Test Suite

1. Run type check:
   ```bash
   cd packages/cli && npx tsc --noEmit
   ```
   Expected: 0 errors in new/modified files.

2. Run all affected specs:
   ```bash
   cd packages/cli && for f in \
     src/private/utils/config.spec.ts \
     src/private/utils/install/parse-source/index.spec.ts \
     src/private/errors/installErrors.spec.ts \
     src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts \
     src/private/utils/use/get-powerup/getPowerup.spec.ts \
     src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.spec.ts \
     src/private/utils/shared/register-powerup.spec.ts \
     src/private/commands/install/install.spec.ts \
     src/private/commands/create/create.spec.ts; do
     echo "--- $f ---"; npx proby "$f" 2>&1 | tail -5;
   done
   ```

3. Run `check-for-powerup-in-config.spec.ts`:
   ```bash
   npx proby src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/check-for-powerup-in-config.spec.ts
   ```

4. Verify no regressions in use command tests:
   ```bash
   npx proby src/private/commands/use/use.spec.ts
   ```

## Summary

| Phase | Files | New? |
|-------|-------|------|
| 1 | `packages/sdk/src/private/schema/config.ts` | No |
| 2 | `packages/cli/src/private/utils/config.ts`, `config.spec.ts` | No |
| 3 | `packages/cli/src/private/utils/shared/matches-powerup-name.ts` | **Yes** |
| 4 | `packages/cli/src/private/utils/install/parse-source/index.ts`, `index.spec.ts` | No |
| 5 | `packages/cli/src/private/errors/installErrors.ts`, `installErrors.spec.ts` | No |
| 6 | `packages/cli/src/private/utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed.ts` | **Yes** |
| 7 | `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts`, `.spec.ts` | No |
| 8 | `packages/cli/src/private/utils/use/get-powerup/getPowerup.ts` | No |
| 9 | `packages/cli/src/private/utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig.ts`, `.spec.ts` | No |
| 10 | `packages/cli/src/private/utils/shared/register-powerup.ts`, `.spec.ts` | No |
| 11 | `packages/cli/src/private/commands/install/index.ts`, `install.spec.ts` | No |
| 12 | (verification only) | — |

**Total**: 2 new files, 14 modified files, 12 phases.