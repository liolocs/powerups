# Uninstall Command Implementation Plan

## Overview

Implement the `pup uninstall` command per the design spec at `docs/superpowers/specs/2026-08-24-uninstall-command-design.md`. The command reverses the install flow: find a powerup by name in config, remove the config entry, and clean up installed files from disk.

## Phases

### Phase 1: Shared helper `find-powerup-in-config.ts` + spec

**New file:** `packages/cli/src/private/utils/shared/find-powerup-in-config.ts`

Extracts the config-search logic from `getPowerupInstallFromConfig`. Imports `getConfig` from `#utils/use/get-powerup/getConfig` and `matchesPowerupName` from `#utils/shared/matches-powerup-name`. Calls `getConfig` inside a try/catch — if config is missing or invalid, returns null (never throws). Searches `config.packages` with `matchesPowerupName`, returns the full `PackageEntry` or null.

```ts
import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
import matchesPowerupName from "#utils/shared/matches-powerup-name";

export default async function findPowerupInConfig({
  configRef,
  powerupName,
}: {
  configRef: FileRef;
  powerupName: string;
}): Promise<PackageEntry | null> {
  let config;
  try {
    config = await getConfig(configRef);
  } catch {
    return null;
  }

  return config.packages.find(pkg => matchesPowerupName(pkg, powerupName)) ?? null;
}
```

**New file:** `packages/cli/src/private/utils/shared/find-powerup-in-config.spec.ts`

Tests:
- "should return the entry when a powerup name matches a string entry" — config with `"internal:my-powerup"`, search for `"my-powerup"` → returns the string
- "should return the entry when a powerup name matches an object entry with name field" — config with `{ package: "npm:pkg", name: "my-powerup" }`, search for `"my-powerup"` → returns the object
- "should return the entry when a powerup name matches an object entry without name field (legacy)" — config with `{ package: "git:github.com/owner/my-powerup" }`, search for `"my-powerup"` → returns the object
- "should return null when the powerup name is not in config" — config with entries, search for `"nonexistent"` → null
- "should return null when the config file does not exist" — no config file → null
- "should return null when the config file is invalid" — write garbage to config → null

Uses `setupTestDir()`/`cleanup()` pattern with `runtime.projectRoot().append("/tmp")`.

### Phase 2: Refactor `getPowerupInstallFromConfig` + update spec

**Modified file:** `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts`

Replace the inline config-reading + search logic with a call to `findPowerupInConfig`. If null → throws `use_errors.not_in_config`. Otherwise returns `{ source: getPackageSource(entry) }`.

```ts
import use_errors from "#errors/useErrors";
import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getPackageSource } from "#utils/config";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";

export default async function getPowerupInstallFromConfig({
  powerupName,
  configRef,
}: {
  powerupName: string;
  configRef: FileRef;
}): Promise<{ source: string }> {
  const entry = await findPowerupInConfig({ configRef, powerupName });

  if (entry === null) {
    throw use_errors.not_in_config(powerupName);
  }

  return { source: getPackageSource(entry) };
}
```

Note: The local `getPackageSource` function is removed — now imported from `#utils/config` (where it already exists). The `is` import and `matchesPowerupName` import are removed.

**Behavior change:** Previously, `getPowerupInstallFromConfig` threw `config_invalid_file` for corrupted configs. After refactor, it throws `not_in_config` for any failure (missing config, invalid config, or powerup not found). This is acceptable because:
1. `getPowerup` (the only caller in the use flow) already catches ALL errors from `getPowerupInstallFromConfig` and treats them identically
2. The distinction between "config missing" and "powerup not in config" is not actionable for users

**Modified file:** `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts`

Update the test "should give an invalid config file if the config is invalid" to expect `UseErrorCode.not_in_config` instead of `UseErrorCode.config_invalid_file`. All other tests remain unchanged.

### Phase 3: `removePackageFromGlobalConfig` in `config.ts` + spec

**Modified file:** `packages/cli/src/private/utils/config.ts`

Add new function after `removePackageFromConfig`:

```ts
export async function removePackageFromGlobalConfig(
  source: string,
  homeDir?: string,
): Promise<void> {
  const config = await readGlobalConfig(homeDir);
  if (config === null) return;

  config.packages = config.packages.filter(p => getPackageSource(p) !== source);
  await writeGlobalConfig(config, homeDir);
}
```

Mirrors `removePackageFromConfig` but operates on global config via `readGlobalConfig`/`writeGlobalConfig`. Does nothing if the global config doesn't exist.

**Modified file:** `packages/cli/src/private/utils/config.spec.ts`

Add tests in a new `test.group` or individual `test.case` entries:
- "should remove a package from global config by source" — write global config with entries, remove one, verify it's gone
- "should do nothing if the global config does not exist" — no global config, call remove, verify no error

### Phase 4: `errors/uninstallErrors.ts` + spec

**New file:** `packages/cli/src/private/errors/uninstallErrors.ts`

Three error codes following `installErrors.ts` pattern:

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const uninstall_errors = error.coded({
  missing_name: () => {
    const errorText =
      `Powerup name required.\n\nUsage: ${CLI_CMD} uninstall <name> [flags]`;
    return t`${errorBGText}${errorText}`;
  },

  not_installed: (name: string) => {
    const errorText =
      `"${name}" is not installed.\n` +
      `Use "${CLI_CMD} install" to install it first.`;
    return t`${errorBGText}${errorText}`;
  },

  internal_not_uninstallable: (name: string) => {
    const errorText =
      `"${name}" is an internal powerup. Internal powerups are created with "${CLI_CMD} create", not installed, so they cannot be uninstalled.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type UninstallErrorCode = keyof typeof uninstall_errors;
export const UninstallErrorCode = Object.fromEntries(
  Object.keys(uninstall_errors).map(k => [k, k]),
) as { [K in UninstallErrorCode]: K };

export default uninstall_errors;
```

**New file:** `packages/cli/src/private/errors/uninstallErrors.spec.ts`

Tests (following `installErrors.spec.ts` pattern):
- "should include the uninstall command name in missing_name usage hint" — verify code + message includes "uninstall"
- "should include the powerup name in not_installed error" — verify code + message includes name + "install"
- "should include the powerup name in internal_not_uninstallable error" — verify code + message includes name + "create"

### Phase 5: Pre-uninstall checks + spec

**New file:** `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed.ts`

```ts
import uninstall_errors from "#errors/uninstallErrors";
import is from "@rcompat/is";

export default function checkNameWasPassed(name?: string): void {
  if (is.undefined(name) || name === "") {
    throw uninstall_errors.missing_name();
  }
}
```

**New file:** `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/check-not-internal.ts`

```ts
import uninstall_errors from "#errors/uninstallErrors";

export default function checkNotInternal({
  parsedType,
  name,
}: {
  parsedType: "npm" | "git" | "internal";
  name: string;
}): void {
  if (parsedType === "internal") {
    throw uninstall_errors.internal_not_uninstallable(name);
  }
}
```

Note: This is simpler than install's `checkNotInternal` — no need to check global config for internal registrations. The powerup was already found in config; if it resolves to internal type, it's not uninstallable. No async needed.

**New file:** `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/index.ts`

```ts
import checkNameWasPassed from "#utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed";
import checkNotInternal from "#utils/uninstall/check-for-pre-uninstall-errors/check-not-internal";

export default function checkForPreUninstallErrors({
  name,
  parsedType,
}: {
  name?: string;
  parsedType: "npm" | "git" | "internal";
}): void {
  checkNameWasPassed(name);
  checkNotInternal({ parsedType, name: name! });
}
```

Note: Synchronous (no async needed) — both checks are simple validations.

**New file:** `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/index.spec.ts`

Tests:
- "should throw missing_name when no name is passed" — `name: undefined` → throws `UninstallErrorCode.missing_name`
- "should throw internal_not_uninstallable when parsed type is internal" — `parsedType: "internal"` → throws `UninstallErrorCode.internal_not_uninstallable`
- "should not throw when name is passed and type is npm" — `name: "my-powerup"`, `parsedType: "npm"` → `noErrorAsync`
- "should not throw when name is passed and type is git" — `name: "my-powerup"`, `parsedType: "git"` → `noErrorAsync`

Note: Since the orchestrator is synchronous, tests use `@ts-expect-error` + sync throw pattern for error cases and `noErrorAsync` for success cases.

### Phase 6: `remove-install-directory.ts` + spec

**New file:** `packages/cli/src/private/utils/uninstall/remove-install-directory.ts`

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import { INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

export default async function removeInstallDirectory({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  if (parsedSource.type === "npm") {
    await removeNpmPackage({ powerupDir, parsedSource });
  } else {
    await removeGitDirectory({ powerupDir, parsedSource });
  }
}

async function removeNpmPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const packageName = parsedSource.configEntry.slice(4);
  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);

  if (!(await fs.exists(npmDir))) {
    return;
  }

  cli.print(`Running npm uninstall in ${npmDir.path}...\n`);
  try {
    const stdout = await io.run(`npm uninstall ${packageName}`, { cwd: npmDir.path });
    if (stdout) cli.print(stdout);
  } catch (error_) {
    const message = typeof error_ === "string" ? error_ : String(error_);
    cli.print(`Warning: npm uninstall failed: ${message}\n`);
  }
}

async function removeGitDirectory({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const targetDir = powerupDir.append(`/${parsedSource.storePath}`);

  if (!(await fs.exists(targetDir))) {
    return;
  }

  await targetDir.remove();
}
```

Key behaviors:
- npm: runs `npm uninstall <packageName>` in the `installed/npm/` directory. If the npm store doesn't exist, silently returns. If `npm uninstall` fails, prints a warning but does not throw (config entry already removed at this point).
- git: removes the cloned directory via `FileRef.remove()`. If directory doesn't exist, silently returns.
- Both use early-return for missing directories (idempotent).

**New file:** `packages/cli/src/private/utils/uninstall/remove-install-directory.spec.ts`

Tests:
- "should remove a git install directory" — create a directory at the git store path, call `removeInstallDirectory`, verify directory is gone
- "should not throw when the git install directory does not exist" — no directory, call `removeInstallDirectory`, no error
- "should run npm uninstall for npm packages" — create an npm store dir with `package.json` containing dependencies, call `removeInstallDirectory`, verify the package is removed from `node_modules/` and `package.json`

Note: The npm test creates a real `installed/npm/` directory with a `package.json` and runs `npm install` first to set up `node_modules/`, then verifies `npm uninstall` removes the package. This may be slow — consider using a local dummy package or mocking. Alternatively, verify that the `npm uninstall` command is called by checking the directory state after.

### Phase 7: `print-uninstall-summary.ts` + spec

**New file:** `packages/cli/src/private/utils/uninstall/print-uninstall-summary.ts`

```ts
import cli from "@rcompat/cli";

export default function printUninstallSummary({
  powerupName,
  source,
  isLocal,
  storeType,
  isDryRun,
  removedPath,
}: {
  powerupName: string;
  source: string;
  isLocal: boolean;
  storeType: "npm" | "git" | "internal";
  isDryRun: boolean;
  removedPath: string;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const location = isLocal ? "local" : "global";

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would uninstall ${powerupName}\n`);
  } else {
    cli.print(`${green("✓")} Uninstalled ${powerupName}\n`);
  }

  cli.print(`  ${dim("source:")} ${source}\n`);
  cli.print(`  ${dim("location:")} ${location}\n`);
  cli.print(`  ${dim("store:")} ${storeType}\n`);

  if (!isDryRun) {
    cli.print(`  ${dim("path:")} ${removedPath}\n`);
  }
}
```

Mirrors `printInstallSummary` but with "Uninstalled" wording and includes `powerupName` + `source` fields.

**New file:** `packages/cli/src/private/utils/uninstall/print-uninstall-summary.spec.ts`

Tests:
- "should print uninstalled message with powerup name and path in non-dry-run mode" — verify output includes "Uninstalled", powerup name, source, location, store, path
- "should print dry-run message without path in dry-run mode" — verify output includes "(dry-run)", "Would uninstall", powerup name, no path line

Note: Testing `cli.print` output requires capturing stdout. Check how other print summary tests work — if no existing tests capture output, these tests may just verify the function runs without error (smoke test). Check `print-install-summary` for existing test patterns.

### Phase 8: Command `commands/uninstall/index.ts` + registration

**New file:** `packages/cli/src/private/commands/uninstall/index.ts`

```ts
import { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import path from "node:path";
import { homedir } from "node:os";
import fs from "@rcompat/fs";
import { SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, CONFIG_FILE_NAME } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import { getPackageSource } from "#utils/config";
import parseSource from "#utils/install/parse-source/index";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";
import { removePackageFromConfig, removePackageFromGlobalConfig } from "#utils/config";
import checkForPreUninstallErrors from "#utils/uninstall/check-for-pre-uninstall-errors/index";
import removeInstallDirectory from "#utils/uninstall/remove-install-directory";
import printUninstallSummary from "#utils/uninstall/print-uninstall-summary";
import uninstall_errors from "#errors/uninstallErrors";

const dryRunFlag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print what would be removed without making changes",
  type: "boolean",
} as const satisfies Flag;

const localFlag = {
  name: "local", long: "local", short: "l",
  description: "Uninstall from local project store instead of global",
  type: "boolean",
} as const satisfies Flag;

const uninstall = new Command({
  name: "uninstall",
  description: `Uninstall a ${SINGULAR_NAME_FOR_CLI}`,
  flags: [dryRunFlag, localFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? runtime.cwd();
    const isDryRun = flags.dryRun === true;
    const isLocal = flags.local === true;
    const homeDir = context?.homeDir ?? homedir();

    const powerupName = subcommands?.[0];

    checkForPreUninstallErrors({
      name: powerupName,
      parsedType: "npm", // placeholder — real type determined after lookup
    });
```

Wait — there's a subtlety. The spec flow is:
1. Check name was passed
2. Find in config
3. Parse source → determine type
4. Check not internal
5. Dry-run or proceed

The `checkNameWasPassed` can run first (before config lookup). But `checkNotInternal` needs the `parsedType` which comes from `parseSource(source)` which comes from the config lookup. So the checks can't be bundled into one orchestrator call with both at once.

Let me revise: `checkForPreUninstallErrors` should only check `checkNameWasPassed`. The `checkNotInternal` check happens after the config lookup, as a separate step in the command.

Actually, re-reading the spec:
> Pre-uninstall checks: `utils/uninstall/check-for-pre-uninstall-errors/`
> - `check-name-was-passed.ts` — throws `missing_name` if no subcommand
> - `check-not-internal.ts` — throws `internal_not_uninstallable` if `parsedSource.type === "internal"`
> - `index.ts` — orchestrator calling both

The spec says the orchestrator calls both. But `checkNotInternal` needs the parsed type, which requires the config lookup first. So either:
1. The orchestrator is called twice (once for name, once for internal check after lookup)
2. The orchestrator takes both `name` and `parsedType` and is called after the lookup
3. The checks are called separately in the command

Looking at the install command's pattern: `checkForPreInstallErrors` is called once at the start with all the info. For uninstall, the `checkNameWasPassed` should happen before the config lookup (no point reading config if no name was passed), and `checkNotInternal` should happen after the config lookup (when we know the type).

The cleanest approach: call `checkNameWasPassed` first, then after the lookup + parse, call `checkNotInternal`. The `index.ts` orchestrator can still exist but would be called after the lookup with both `name` and `parsedType`. But `checkNameWasPassed` would be redundant at that point since the name was already checked.

Let me simplify: keep the `index.ts` orchestrator but call it after the config lookup. It runs both checks — `checkNameWasPassed` is a quick guard that passes harmlessly if the name was already validated, and `checkNotInternal` does the real work. This matches the spec's "orchestrator calling both" while being practical.

Actually, the simplest and most correct approach: call `checkNameWasPassed` early in the command (before config lookup), and call `checkNotInternal` separately after the lookup. The `index.ts` file exports both individual functions and the orchestrator. The command uses the individual functions directly for the two-phase check. The orchestrator exists for cases where both checks can run at the same point (e.g., in tests).

Let me revise the command structure:

```ts
action: async ({ context, subcommands, flags }) => {
  const projectRoot = context?.root ?? runtime.cwd();
  const isDryRun = flags.dryRun === true;
  const isLocal = flags.local === true;
  const homeDir = context?.homeDir ?? homedir();

  const powerupName = subcommands?.[0];
  checkNameWasPassed(powerupName);

  const configRef = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`)
    : fs.ref(path.join(homeDir, CLI_FOLDER_NAME, CONFIG_FILE_NAME));

  const entry = await findPowerupInConfig({ configRef, powerupName: powerupName! });

  if (entry === null) {
    throw uninstall_errors.not_installed(powerupName!);
  }

  const source = getPackageSource(entry);
  const parsedSource = parseSource(source);

  checkNotInternal({ parsedType: parsedSource.type, name: powerupName! });

  const powerupDir = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}`)
    : fs.ref(path.join(homeDir, CLI_FOLDER_NAME));

  const removedPath = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`).path
    : path.join(homeDir, CLI_FOLDER_NAME, parsedSource.storePath);

  if (!isDryRun) {
    if (isLocal) {
      await removePackageFromConfig(projectRoot, source);
    } else {
      await removePackageFromGlobalConfig(source, homeDir);
    }

    await removeInstallDirectory({ powerupDir, parsedSource });
  }

  printUninstallSummary({
    powerupName: powerupName!,
    source: parsedSource.configEntry,
    isLocal,
    storeType: parsedSource.type,
    isDryRun,
    removedPath,
  });
}
```

This is cleaner — `checkNameWasPassed` and `checkNotInternal` are called at the appropriate points in the flow. The `index.ts` orchestrator still exists but is used in tests to verify both checks together.

**New file:** `packages/cli/src/commands/uninstall.ts`

```ts
import uninstall from "../private/commands/uninstall/index.js";
export default uninstall;
```

**Modified file:** `packages/cli/src/commands/index.ts`

Add uninstall:
```ts
import { type Command } from "@liolocs/program";
import build from "./build.js";
import create from "./create.js";
import install from "./install.js";
import uninstall from "./uninstall.js";
import use from "./use.js";

const commands: Command<any>[] = [
  build,
  create,
  install,
  uninstall,
  use,
];
export default commands;
```

### Phase 9: Integration test `uninstall.spec.ts`

**New file:** `packages/cli/src/private/commands/uninstall/uninstall.spec.ts`

Tests following `install.spec.ts` patterns. Uses `createSimpleProjectForTest` for project setup, `testRoot`/`globalTestRoot` for local/global isolation, real npm/git installs followed by uninstall verification.

Test setup: Install a real powerup first (using the install command), then uninstall it and verify:
- Config entry removed
- Install directory removed (or npm package removed from node_modules + package.json)

Tests:
1. "should uninstall an npm powerup from global config without errors" — install `npm:@liolocs/powerup-hello-world` globally, then uninstall `powerup-hello-world` globally, verify config entry gone + directory gone
2. "should uninstall a git powerup from local config without errors" — install `git:github.com/liolocs/powerup-hello-world` locally, then uninstall `powerup-hello-world` locally, verify config entry gone + directory gone
3. "should not remove config or files in dry-run mode" — install a powerup, then uninstall with `--dry-run`, verify config entry still present + directory still exists
4. "should throw not_installed when the powerup is not in config" — uninstall a name that was never installed → `UninstallErrorCode.not_installed`
5. "should throw internal_not_uninstallable when uninstalling an internal powerup" — add `"internal:my-powerup"` to config, uninstall `my-powerup` → `UninstallErrorCode.internal_not_uninstallable`
6. "should throw missing_name when no powerup name is passed" — empty subcommands → `UninstallErrorCode.missing_name`

Note: Tests 1-2 require network access (real npm/git install). Tests 3-6 can be done with manual config/directory setup without network.

For tests that need pre-installed powerups, either:
- Call `install.run()` first (requires network)
- Or manually set up the config + directory structure (faster, no network dependency)

Prefer manual setup where possible to avoid network flakiness. For the full-flow tests (1-2), use real install + uninstall. For the error case tests (3-6), use manual config/directory setup.

### Phase 10: Type check + full test suite

Run `npx tsc --noEmit` from `packages/cli/` — verify 0 type errors.

Run all new + modified spec files:
- `find-powerup-in-config.spec.ts`
- `getPowerupInstallFromConfig.spec.ts` (updated)
- `config.spec.ts` (updated)
- `uninstallErrors.spec.ts`
- `check-for-pre-uninstall-errors/index.spec.ts`
- `remove-install-directory.spec.ts`
- `print-uninstall-summary.spec.ts`
- `uninstall.spec.ts`

Also run existing specs that might be affected by the `getPowerupInstallFromConfig` refactor:
- `use.spec.ts`
- `getPowerup.spec.ts`
- `getPowerupInstallFromConfig.spec.ts`

## File Summary

### New files (14)
1. `packages/cli/src/private/utils/shared/find-powerup-in-config.ts`
2. `packages/cli/src/private/utils/shared/find-powerup-in-config.spec.ts`
3. `packages/cli/src/private/errors/uninstallErrors.ts`
4. `packages/cli/src/private/errors/uninstallErrors.spec.ts`
5. `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed.ts`
6. `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/check-not-internal.ts`
7. `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/index.ts`
8. `packages/cli/src/private/utils/uninstall/check-for-pre-uninstall-errors/index.spec.ts`
9. `packages/cli/src/private/utils/uninstall/remove-install-directory.ts`
10. `packages/cli/src/private/utils/uninstall/remove-install-directory.spec.ts`
11. `packages/cli/src/private/utils/uninstall/print-uninstall-summary.ts`
12. `packages/cli/src/private/utils/uninstall/print-uninstall-summary.spec.ts`
13. `packages/cli/src/private/commands/uninstall/index.ts`
14. `packages/cli/src/commands/uninstall.ts`

### Modified files (4)
1. `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.ts` — refactored to use `findPowerupInConfig`
2. `packages/cli/src/private/utils/use/get-powerup/getPowerupInstallFromConfig.spec.ts` — update invalid config test expectation
3. `packages/cli/src/private/utils/config.ts` — add `removePackageFromGlobalConfig`
4. `packages/cli/src/private/utils/config.spec.ts` — add tests for `removePackageFromGlobalConfig`
5. `packages/cli/src/commands/index.ts` — register uninstall command
6. `packages/cli/src/private/commands/uninstall/uninstall.spec.ts` — integration test

Total: 14 new files, 6 modified files, 20 files changed.