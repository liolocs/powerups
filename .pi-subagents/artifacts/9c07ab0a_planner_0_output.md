# Implementation Plan: Global Init & Harness Removal

**Spec:** `docs/superpowers/specs/2026-07-23-global-init-harness-removal-design.md`
**Date:** 2026-07-23

## Overview

Rework `pup init` / `pup install` / `pup add` / `pup update` to mirror pi.dev's philosophy: global initialization by default, with opt-in local project configuration. Remove the `harness` property from `config.json` in favor of auto-detecting all available agent harnesses at runtime. Clean break — no backward compatibility.

The plan is organized into 7 phases. Each phase is self-contained and testable. Phases 1–3 are foundational (shared utilities), phase 4–5 are command-level changes, phase 6 is the new command, and phase 7 is CLI wiring + test updates.

---

## Phase 1: Config — Remove `harness` from Schema & Types

**File:** `packages/cli/src/private/utils/config.ts`

### Changes

1. **Remove `harness` from the `Config` type:**
   ```ts
   // Before:
   export type Config = {
     harness: string;
     packages: PackageEntry[];
   };
   // After:
   export type Config = {
     packages: PackageEntry[];
   };
   ```

2. **Merge `configSchema` and `globalConfigSchema` into one schema** (no `harness` field):
   ```ts
   const configSchema = p({
     [PACKAGES_KEY]: p.array(p.unknown).optional(),
   });
   ```
   Remove the separate `globalConfigSchema` entirely. Both `readConfig` and `readGlobalConfig` use `configSchema`.

3. **Update `readConfig`** — remove `harness` from the return:
   ```ts
   // Before:
   return {
     harness: raw.harness,
     packages: (raw.packages ?? []) as PackageEntry[],
   };
   // After:
   return {
     packages: (raw.packages ?? []) as PackageEntry[],
   };
   ```

4. **Update `readGlobalConfig`** — return type changes from `{ packages: PackageEntry[] }` to `Config | null` (to match `readConfig` semantics). Currently returns `{ packages: [] }` when file doesn't exist. Change to:
   ```ts
   export async function readGlobalConfig(): Promise<Config | null> {
     const configPath = fs.ref(GLOBAL_CONFIG_PATH);
     if (!(await fs.exists(configPath))) {
       return null;
     }
     const raw = configSchema.parse(await configPath.json());
     return {
       packages: (raw.packages ?? []) as PackageEntry[],
     };
   }
   ```
   **Important:** This changes the return type from always-defined `{ packages: [] }` to `Config | null`. All callers of `readGlobalConfig` must be updated to handle `null`. The callers are:
   - `addPackageToGlobalConfig` in config.ts — update to handle null by creating config first
   - `list/index.ts` — add global config sources to registeredSources filter (new, phase 5)
   - `resolve-powerup.ts` — new `fallbackToGlobal` logic (phase 3)

5. **Update `writeGlobalConfig`** — signature changes from `{ packages: PackageEntry[] }` to `Config`:
   ```ts
   export async function writeGlobalConfig(config: Config): Promise<void> {
     // ... same body, no harness to write
   }
   ```

6. **Update `addPackageToGlobalConfig`** — handle null from `readGlobalConfig`:
   ```ts
   export async function addPackageToGlobalConfig(entry: PackageEntry): Promise<void> {
     const config = await readGlobalConfig() ?? { packages: [] };
     // ... rest unchanged
   }
   ```

7. **Update `addPackageToConfig`** — currently silently returns if config is null. Per the spec, `add` command will check for config existence before calling this. Keep the null-return behavior here (the guard is in the command, not the utility). No change needed to this function.

### Test file: `packages/cli/src/private/utils/config.spec.ts`

- Remove all `harness` from test fixtures. Every `writeJSON({ harness: "pi", packages: [] })` → `writeJSON({ packages: [] })`.
- Every `writeConfig(testRoot, { harness: "claude", packages: [] })` → `writeConfig(testRoot, { packages: [] })`.
- Remove the test case `"should read harness from config file"`.
- Add test: `"should return null from readGlobalConfig when file does not exist"`.
- Update test: `"should write config file with harness"` → `"should write config file"` (assert no harness field in output).
- All `addPackageToConfig` test fixtures: remove `harness` from the `writeJSON` calls.

---

## Phase 2: Detection — `detectHarness` → `detectHarnesses`

**File:** `packages/cli/src/private/scaffold/detect.ts`

### Changes

1. **Rename function** from `detectHarness` to `detectHarnesses`.

2. **Change return type** from `Promise<Harness>` to `Promise<Harness[]>`.

3. **Remove `projectRoot` parameter** — detection is global-only now. The function no longer needs a project root. Signature:
   ```ts
   export async function detectHarnesses(
     harnessFlag: string | undefined,
   ): Promise<Harness[]>
   ```

4. **Remove `options` parameter** (`skipGlobal` no longer needed).

5. **Remove local fingerprint scanning** (the `projectRoot.append("/CLAUDE.md")` etc. block).

6. **Rewrite detection logic:**
   ```ts
   export async function detectHarnesses(
     harnessFlag: string | undefined,
   ): Promise<Harness[]> {
     // 1. --harness override → return [single]
     if (harnessFlag !== undefined) {
       if (!VALID_HARNESSES.includes(harnessFlag as Harness)) {
         throw init_errors.invalid_harness(harnessFlag);
       }
       return [harnessFlag as Harness];
     }

     // 2. Scan global fingerprints
     const found = new Set<Harness>();
     if (await fs.exists(fs.ref(path.join(HOME, ".claude")))) found.add("claude");
     if (await fs.exists(fs.ref(path.join(HOME, ".pi", "agent")))) found.add("pi");
     if (await fs.exists(fs.ref(path.join(HOME, ".config", "opencode")))) found.add("opencode");
     if (await fs.exists(fs.ref(path.join(HOME, ".codex")))) found.add("codex");

     if (found.size === 0) {
       throw init_errors.no_harness_detected();
     }

     return [...found];
   }
   ```
   Note: `codex` global fingerprint at `~/.codex` is new — add it (the harness config already supports codex in scaffold, but detect.ts didn't check for it globally).

7. **Keep `VALID_HARNESSES` and `Harness` type exports** unchanged.

### Test file: `packages/cli/src/private/scaffold/detect.spec.ts`

- Complete rewrite. All tests now call `detectHarnesses(flag)` instead of `detectHarnesses(projectRoot, flag, { skipGlobal: true })`.
- Tests can no longer use local dir-based detection (creating `./.claude` etc. in testRoot). Instead, tests must mock or set up global fingerprints. Since tests run in a shared environment, the safest approach is:
  - For `--harness` override tests: `detectHarnesses("codex")` → returns `["codex"]` (no filesystem deps).
  - For invalid harness: `detectHarnesses("foo")` → throws `invalid_harness`.
  - For global detection tests: these are harder to unit test without modifying the home directory. Consider:
    - Option A: Skip global detection unit tests (test them via integration in init/update specs).
    - Option B: Add a `customHome` option for testing: `detectHarnesses(flag, { homeDir })`.
  - **Recommendation: Option B** — add an optional `homeDir` parameter for testability:
    ```ts
    export async function detectHarnesses(
      harnessFlag: string | undefined,
      options?: { homeDir?: string },
    ): Promise<Harness[]>
    ```
    Use `options?.homeDir ?? HOME` for fingerprint paths. This allows tests to point at a temp dir.

- Remove all tests for `multiple_harnesses_detected` (no longer an error).
- Add test: `"returns all detected harnesses when multiple found"`.
- Add test: `"returns empty array → throws no_harness_detected"` (already exists but update call signature).

---

## Phase 3: Scaffold — Multi-Harness Support

**File:** `packages/cli/src/private/scaffold/index.ts`

### Changes

1. **Update import** — `detectHarness` → `detectHarnesses`:
   ```ts
   import { detectHarnesses, type Harness } from "#scaffold/detect";
   ```

2. **Update `ScaffoldResult`:**
   ```ts
   export interface ScaffoldResult {
     harnesses: Harness[];  // was: harness: Harness
     filesWritten: string[];
   }
   ```

3. **Update `scaffold` function signature:**
   ```ts
   // Before:
   export async function scaffold(
     projectRoot: FileRef,
     harnessFlag: string | undefined,
     options?: { skipGlobal?: boolean; rollback?: RollbackInfo },
   ): Promise<ScaffoldResult>

   // After:
   export async function scaffold(
     homeDir: FileRef,
     harnessFlag: string | undefined,
     options?: { rollback?: RollbackInfo },
   ): Promise<ScaffoldResult>
   ```
   - Parameter renamed from `projectRoot` to `homeDir` (it's now always the home directory).
   - Remove `skipGlobal` from options.

4. **Update scaffold body** — call `detectHarnesses` and loop:
   ```ts
   const harnesses = await detectHarnesses(harnessFlag, { homeDir: homeDir.path });
   const filesWritten: string[] = [];
   const rollback = options?.rollback;

   // Render agents template once (same for all harnesses)
   const agentsRendered = await runTemplate({
     templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
     variables,
   });

   for (const harness of harnesses) {
     const config = HARNESS_CONFIG[harness];

     // ... existing instruction file logic (backup, writeToAgentsOrClaudeMD, rollback tracking)
     // ... existing skill file loop

     // Collect filesWritten for this harness
   }

   return { harnesses, filesWritten };
   ```
   The agents template is rendered once and reused for all harnesses (the template content is the same regardless of harness — it's the output path that differs).

5. **Remove `RollbackInfo` type export** — keep it (still used by init).

### Test file: `packages/cli/src/private/scaffold/index.ts`

- No separate scaffold spec file exists. Scaffold is tested via init/update specs.

---

## Phase 4: Error Files

### `packages/cli/src/private/errors/initErrors.ts`

- **Remove** `dry_folder_exists` error.
- **Remove** `multiple_harnesses_detected` error.
- **Add** `global_already_initialized`:
  ```ts
  global_already_initialized: () => {
    return t`${errorLabel} ${CLI_NAME} is already initialized globally.`;
  },
  ```
- **Update** `main_folder_not_found` → `global_not_initialized`:
  ```ts
  global_not_initialized: () => {
    const errorText = `${CLI_NAME} is not initialized. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```
- **Keep** `no_harness_detected` (update help text to reflect global init):
  ```ts
  no_harness_detected: () => {
    return t`${errorLabel} No AI coding harness detected.\n\n  ${specifyHarness}`;
  },
  ```
  Update `specifyHarness` to use `pup init` (already does).
- **Keep** `invalid_harness` and `agents_section_render_failed` unchanged.

### `packages/cli/src/private/errors/updateErrors.ts`

- **Remove** `no_harness_config` error.
- **Add** `no_harnesses_detected`:
  ```ts
  no_harnesses_detected: () => {
    const errorText = `No harness detected — pass --harness to specify one.\n\n  ${CLI_CMD} update --harness=claude\n  ${CLI_CMD} update --harness=opencode\n  ${CLI_CMD} update --harness=pi\n  ${CLI_CMD} update --harness=codex`;
    return t`${errorLabel}${errorText}`;
  },
  ```
  Note: This is actually the same as `init_errors.no_harness_detected` since `detectHarnesses` throws `no_harness_detected` from initErrors. So this error may not be needed separately. **Decision: do not add this error** — `detectHarnesses` already throws `init_errors.no_harness_detected` when nothing is found. The update command doesn't need its own version.

### `packages/cli/src/private/errors/projectErrors.ts` (NEW FILE)

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;
const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const project_errors = error.coded({
  project_already_initialized: () => {
    return t`${errorLabel} ${CLI_NAME} is already initialized for this project.`;
  },
  project_not_initialized: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type ProjectErrorCode = keyof typeof project_errors;
export const ProjectErrorCode = Object.fromEntries(
  Object.keys(project_errors).map(k => [k, k]),
) as { [K in ProjectErrorCode]: K };
export default project_errors;
```

### `packages/cli/src/private/errors/useErrors.ts`

- **Update** `main_folder_not_found`:
  ```ts
  // Before:
  main_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  // After:
  main_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```

### `packages/cli/src/private/errors/addErrors.ts`

- **Add** `project_not_initialized`:
  ```ts
  project_not_initialized: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```

### `packages/cli/src/private/errors/installErrors.ts`

- **Add** `global_not_initialized`:
  ```ts
  global_not_initialized: () => {
    const errorText = `${CLI_NAME} is not initialized globally. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```
- **Add** `local_not_initialized`:
  ```ts
  local_not_initialized: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```

### `packages/cli/src/private/errors/infoErrors.ts`

- **Remove** `main_folder_not_found` (info no longer requires local folder — resolution handles the error).
- **Keep** `missing_name` and `not_found` unchanged.

### `packages/cli/src/private/errors/validateErrors.ts`

- No changes needed. The `validate` command currently uses `create_errors.main_folder_not_found` for the folder check. That check will be removed (phase 5). The validate command's own errors (`missing_name`, `not_found`, `invalid`) stay.

### `packages/cli/src/private/errors/createErrors.ts`

- **Update** `main_folder_not_found` to point to `project init`:
  ```ts
  main_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  ```
  Note: The `create` command is not in scope for this spec but it uses `main_folder_not_found` which references the old init command. Update the message text only.

### `packages/cli/src/private/errors/doctorErrors.ts`

- Check if doctor errors reference init. Read the file and update `not_initialized` message to `pup init` if needed (doctor checks for `.powerups` folder which is project-level, so it should say `pup project init`).

---

## Phase 5: Command Changes

### 5.1: `private/commands/init/index.ts` — Global Only

**Rewrite the action:**

```ts
action: async ({ context, subcommands }: any) => {
  // Global root is always ~/.powerups/
  const globalRoot = fs.ref(GLOBAL_ROOT);

  if (await fs.exists(globalRoot)) {
    throw init_errors.global_already_initialized();
  }

  const rollback: RollbackInfo = { remove: [], restore: [] };

  try {
    await fs.create(globalRoot);
    rollback.remove.push(GLOBAL_ROOT);

    // Scaffold to home directory with all detected harnesses
  const harnessArg = subcommands?.[0] as string | undefined;
    const homeDir = fs.ref(homedir());
    const result = await scaffold(homeDir, harnessArg, { rollback });

    // Write global config (no harness)
    await writeGlobalConfig({ packages: [] });

    cli.print(`${green("✓")} Initialized ${CLI_NAME} globally\n`);
    cli.print(`  ${dim("harnesses:")} ${result.harnesses.join(", ")}\n`);
    for (const file of result.filesWritten) {
      cli.print(`  ${dim("wrote:")} ${file}\n`);
    }
  } catch (error) {
    await rollbackChanges({ root: fs.ref(homedir()), rollback });
    throw error;
  }
},
```

**Key changes:**
- Uses `GLOBAL_ROOT` instead of `root.append(MAIN_FOLDER)`.
- Uses `homedir()` as the scaffold target (not project root).
- Calls `writeGlobalConfig` instead of `writeConfig`.
- Output says "Initialized globally" and lists all harnesses.
- `rollbackChanges` needs to operate on the home directory.
- Add import: `import { homedir } from "node:os"`.
- Add import: `GLOBAL_ROOT` from constants.
- Add import: `writeGlobalConfig` from config utils.
- Remove import: `writeConfig` (no longer used).
- Remove import: `MAIN_FOLDER` (no longer used for local folder creation).
- Keep `CLI_NAME` import.
- The `context?.skipGlobal` is no longer used (remove from scaffold call).
- **Flags:** Add a `--harness` flag (was previously a positional arg `subcommands[0]`). Actually, looking at the current code, harness is passed as `subcommands[0]` (positional). The spec says `--harness` flag for init too. Let me re-read the spec... The spec says "If no harness is detected, requires `--harness <name>` to proceed". The current code uses positional args. **Decision: keep positional arg for init** (consistent with current behavior, `pup init claude`). The `--harness` flag is only documented for `update`.

### 5.2: `private/commands/install/index.ts` — Flip Default

**Changes:**

1. **Replace `--global`/`-g` flag with `--local`/`-l`:**
   ```ts
   flags: [
     // ... include, exclude stay ...
     {
       name: "local",
       long: "local",
       short: "l",
       description: "Install to local project store instead of global",
     },
   ],
   ```

2. **Flip the default logic:**
   ```ts
   // Before:
   const isGlobal = (rawFlags ?? []).some(f => f.flag === "--global" || f.flag === "-g");
   const storeRoot = isGlobal ? fs.ref(GLOBAL_ROOT) : root.append(`/${MAIN_FOLDER}`);

   // After:
   const isLocal = (rawFlags ?? []).some(f => f.flag === "--local" || f.flag === "-l");
   const storeRoot = isLocal ? root.append(`/${MAIN_FOLDER}`) : fs.ref(GLOBAL_ROOT);
   ```

3. **Add guards:**
   ```ts
   if (isLocal) {
     // Local install requires project init
     const localFolder = root.append(`/${MAIN_FOLDER}`);
     if (!(await fs.exists(localFolder))) {
       throw install_errors.local_not_initialized();
     }
   } else {
     // Global install requires global init
     const globalFolder = fs.ref(GLOBAL_ROOT);
     if (!(await fs.exists(globalFolder))) {
       throw install_errors.global_not_initialized();
     }
   }
   ```

4. **Update config registration logic:**
   ```ts
   // Before:
   if (isGlobal) {
     await addPackageToGlobalConfig(entry);
   }
   // Always add to project config
   await addPackageToConfig(root, entry);

   // After:
   if (isLocal) {
     await addPackageToConfig(root, entry);
   } else {
     await addPackageToGlobalConfig(entry);
   }
   ```
   Global install → register in global config only. Local install → register in local config only. (Previously it always added to project config regardless.)

5. **Update output:** `isGlobal ? "global" : "local"` → `isLocal ? "local" : "global"`.

### 5.3: `private/commands/add/index.ts` — Require Project Init

**Changes:**

1. **Add guard before resolving package:**
   ```ts
   const root: FileRef = context?.root ?? await runtime.projectRoot();
   const mainFolder = root.append(`/${MAIN_FOLDER}`);
   if (!(await fs.exists(mainFolder))) {
     throw add_errors.project_not_initialized();
   }
   ```
   Insert after step 2 (parse fragment), before step 3 (resolvePackage).

2. **Add imports:** `MAIN_FOLDER` from constants, `ProjectErrorCode` not needed (using `add_errors.project_not_initialized`).

3. **No other changes** — the rest of the command stays the same. `addPackageToConfig` will still handle the null case, but we now guard before reaching it.

### 5.4: `private/commands/update/index.ts` — Global Only, Multi-Harness

**Rewrite the action:**

```ts
action: async ({ context, flags }) => {
  const globalRoot = fs.ref(GLOBAL_ROOT);

  if (!(await fs.exists(globalRoot))) {
    throw init_errors.global_not_initialized();
  }

  const harnessFlag = flags.harness !== undefined ? flags.harness as string : undefined;
  const homeDir = fs.ref(homedir());

  const result = await scaffold(homeDir, harnessFlag);

  // No config read/write for harness — nothing to persist

  cli.print(`${green("✓")} Updated ${CLI_NAME} globally\n`);
  cli.print(`  ${dim("harnesses:")} ${result.harnesses.join(", ")}\n`);
  for (const file of result.filesWritten) {
    cli.print(`  ${dim("wrote:")} ${file}\n`);
  }
},
```

**Key changes:**
- Remove `readConfig`/`writeConfig` imports and usage.
- Remove `MAIN_FOLDER` import (no longer checking local folder).
- Remove `init_errors.main_folder_not_found` → use `init_errors.global_not_initialized`.
- Remove `update_errors` import entirely (no_harness_config removed).
- Add imports: `homedir` from `node:os`, `GLOBAL_ROOT` from constants.
- Remove `context?.skipGlobal` from scaffold call.
- Keep `--harness` flag definition.
- `scaffold` call: `scaffold(homeDir, harnessFlag)` — no options needed (no rollback for update).
- Update description: `"Regenerate the docs scaffolded on init"` → `"Regenerate the global docs scaffolded on init"`.

### 5.5: `private/commands/use/index.ts` — Updated Error Message

**Changes:**

1. **Update the error when no `.powerups` folder:**
   ```ts
   // Before:
   if (!hasMainFolder) {
     throw use_errors.main_folder_not_found();
   }
   // After (same call, but error message updated in phase 4):
   if (!hasMainFolder) {
     throw use_errors.main_folder_not_found();
   }
   ```
   The code doesn't change — the error message is updated in `useErrors.ts` (phase 4). No code change needed here.

2. **No other changes** — `use` still requires local config, `resolvePowerUp` still reads local config only (the default `fallbackToGlobal: false`).

### 5.6: `private/commands/validate/index.ts` — Work Anywhere

**Changes:**

1. **Remove the `.powerups` folder check:**
   ```ts
   // Remove these lines:
   const mainFolder = root.append(`/${MAIN_FOLDER}`);
   const hasMainFolder = await fs.exists(mainFolder);
   if (!hasMainFolder) {
     throw create_errors.main_folder_not_found();
   }
   ```

2. **Update `resolvePowerUp` call** to use `fallbackToGlobal: true`:
   ```ts
   const resolved = await resolvePowerUp(root, name, typeFlag, { fallbackToGlobal: true });
   ```

3. **Remove unused imports:** `MAIN_FOLDER` (no longer used), `create_errors` (no longer used).

### 5.7: `private/commands/info/index.ts` — Work Anywhere

**Changes:**

1. **Remove the `.powerups` folder check:**
   ```ts
   // Remove these lines:
   const mainFolder = root.append(`/${MAIN_FOLDER}`);
   if (!(await fs.exists(mainFolder))) {
     throw info_errors.main_folder_not_found();
   }
   ```

2. **Update `resolvePowerUp` call** to use `fallbackToGlobal: true`:
   ```ts
   const resolved = await resolvePowerUp(root, name, typeFlag, { fallbackToGlobal: true });
   ```

3. **Remove unused imports:** `MAIN_FOLDER` (no longer used). Note: `info_errors.main_folder_not_found` is removed in phase 4, so no import change needed beyond removing the usage.

### 5.8: `private/commands/list/index.ts` — Global Config Filter

**Changes:**

1. **Add global config sources to `registeredSources`:**
   ```ts
   // Before:
   const config = await readConfig(root);
   const registeredSources = new Set<string>();
   for (const entry of config?.packages ?? []) {
     registeredSources.add(getPackageSource(entry));
   }

   // After:
   const config = await readConfig(root);
   const globalConfig = await readGlobalConfig();
   const registeredSources = new Set<string>();
   for (const entry of config?.packages ?? []) {
     registeredSources.add(getPackageSource(entry));
   }
   for (const entry of globalConfig?.packages ?? []) {
     registeredSources.add(getPackageSource(entry));
   }
   ```

2. **Add import:** `readGlobalConfig` from `#utils/config`.

3. **Update the "all added" message** — since we now check both local and global registered sources, the message should reflect this:
   ```ts
   // Before:
   cli.print("All installed packages are already added to this project.\n");
   // After:
   cli.print("All installed packages are already registered.\n");
   ```

4. **Update the "available" header:**
   ```ts
   // Before:
   cli.print("Available packages not yet added to this project:\n\n");
   // After:
   cli.print("Available packages not yet registered:\n\n");
   ```

---

## Phase 6: `resolvePowerUp` — `fallbackToGlobal` Option

**File:** `packages/cli/src/private/utils/resolve-powerup.ts`

### Changes

1. **Add `fallbackToGlobal` option to `resolvePowerUp`:**
   ```ts
   export async function resolvePowerUp(
     root: FileRef,
     name: string,
     type?: PowerUpType,
     options?: { fallbackToGlobal?: boolean },
   ): Promise<ResolvedPowerUp>
   ```

2. **Update config reading logic:**
   ```ts
   // Before:
   const config = await readConfig(root);
   if (config === null) {
     throw power_errors.not_found(name);
   }

   // After:
   const localConfig = await readConfig(root);
   const fallbackToGlobal = options?.fallbackToGlobal ?? false;

   if (localConfig === null && !fallbackToGlobal) {
     // use command — requires project init
     throw power_errors.not_found(name);
     // Note: the use command checks for .powerups folder BEFORE calling
     // resolvePowerUp, so this path may not be reached. But keep it as a
     // safety net. The error message is generic "not found" which is fine.
   }

   if (localConfig === null && fallbackToGlobal) {
     const globalConfig = await readGlobalConfig();
     if (globalConfig === null) {
       // Neither local nor global config exists
       throw new Error(`${CLI_NAME} is not initialized — run '${CLI_CMD} init' first`);
     }
   }
   ```

   **Better approach:** Build a merged package list from both configs:
   ```ts
   const localConfig = await readConfig(root);
   const fallbackToGlobal = options?.fallbackToGlobal ?? false;

   // Build the list of packages to search
   const packages: { entry: PackageEntry; isLocal: boolean }[] = [];

   if (localConfig !== null) {
     for (const entry of localConfig.packages) {
       packages.push({ entry, isLocal: true });
     }
   }

   if (fallbackToGlobal) {
     const globalConfig = await readGlobalConfig();
     if (globalConfig !== null) {
       // Add global packages that aren't already in local (by source)
       const localSources = new Set(
         localConfig?.packages.map(getPackageSource) ?? []
       );
       for (const entry of globalConfig.packages) {
         if (!localSources.has(getPackageSource(entry))) {
           packages.push({ entry, isLocal: false });
         }
       }
     }
   }

   if (packages.length === 0) {
     if (localConfig === null && fallbackToGlobal) {
       // Check if global config exists at all
       const globalConfig = await readGlobalConfig();
       if (globalConfig === null) {
         throw new Error(`${CLI_NAME} is not initialized — run '${CLI_CMD} init' first`);
       }
     }
     throw power_errors.not_found(name);
   }
   ```

   **Simplest approach:** Merge the package arrays (local first, then global-only), then run the existing search loop:
   ```ts
   const localConfig = await readConfig(root);
   const fallbackToGlobal = options?.fallbackToGlobal ?? false;

   let entries: PackageEntry[];

   if (localConfig !== null) {
     entries = [...localConfig.packages];
     if (fallbackToGlobal) {
       const globalConfig = await readGlobalConfig();
       if (globalConfig !== null) {
         const localSources = new Set(localConfig.packages.map(getPackageSource));
         for (const entry of globalConfig.packages) {
           if (!localSources.has(getPackageSource(entry))) {
             entries.push(entry);
           }
         }
       }
     }
   } else if (fallbackToGlobal) {
     const globalConfig = await readGlobalConfig();
     if (globalConfig === null) {
       throw new Error(`${CLI_NAME} is not initialized — run '${CLI_CMD} init' first`);
     }
     entries = globalConfig.packages;
   } else {
     throw power_errors.not_found(name);
   }
   ```

   Then the existing for-loop iterates over `entries` instead of `config.packages`.

3. **Add imports:** `readGlobalConfig`, `getPackageSource` from `#utils/config`, `CLI_CMD` from `#constants`.

4. **Add a new error type** for the "not initialized" case. Since `power_errors` is used for powerup-specific errors, and this is a system-level error, consider using a generic `Error` or adding to `initErrors`:
   - **Recommendation:** Add `not_initialized` to `powerErrors.ts`:
     ```ts
     not_initialized: () => {
       const errorText = `${CLI_NAME} is not initialized — run "${CLI_CMD} init" first`;
       return t`${errorBGText}${errorText}`;
     },
     ```
   Then use `throw power_errors.not_initialized()` in resolve-powerup.ts.

### Test file: `packages/cli/src/private/utils/resolve-powerup.spec.ts`

- Update `createConfig` helper: remove `harness` parameter and `harness` from the JSON:
  ```ts
  async function createConfig(
    projectRoot: FileRef,
    packages: PackageEntry[],
  ): Promise<void> {
    const configDir = projectRoot.append(`/${MAIN_FOLDER}`);
    await fs.create(configDir);
    await configDir.append(`/${CONFIG_FILE}`).writeJSON({ packages });
  }
  ```
- Update all `createConfig(testRoot, ["my-pkg"])` calls to remove the harness argument.
- Add new test group: `"resolvePowerUp with fallbackToGlobal"`:
  - Test: resolves from global config when no local config exists
  - Test: merges local + global, local takes priority
  - Test: throws not_initialized when neither local nor global config exists
  - Test: global-only packages are found via fallback

---

## Phase 7: New `pup project init` Command

### New files

1. **`packages/cli/src/commands/project.ts`** — re-export:
   ```ts
   import project from "../private/commands/project/index.js";
   export default project;
   ```

2. **`packages/cli/src/private/commands/project/index.ts`** — command group:
   ```ts
   import { Command } from "@powerups/program";
   import { CLI_NAME } from "#constants";
   import projectInit from "#commands/project/init";

   const project = new Command({
     name: "project",
     description: `Manage ${CLI_NAME} project configuration`,
     flags: [],
     subcommands: [projectInit],
     requiresSubcommand: true,
     action: async () => {
       // Never called — requiresSubcommand is true
     },
   });

   export default project;
   ```

3. **`packages/cli/src/private/commands/project/init/index.ts`** — implementation:
   ```ts
   import fs, { type FileRef } from "@rcompat/fs";
   import cli from "@rcompat/cli";
   import runtime from "@rcompat/runtime";
   import { Command } from "@powerups/program";
   import project_errors from "#errors/projectErrors";
   import { writeConfig } from "#utils/config";
   import { MAIN_FOLDER, CLI_NAME } from "#constants";

   const projectInit = new Command({
     name: "init",
     description: `Initialize ${CLI_NAME} for the current project`,
     flags: [],
     subcommands: [],
     action: async ({ context }: any) => {
       const root: FileRef = context?.root ?? await runtime.projectRoot();
       const mainFolder = root.append(`/${MAIN_FOLDER}`);

       if (await fs.exists(mainFolder)) {
         throw project_errors.project_already_initialized();
       }

       await fs.create(mainFolder);
       await writeConfig(root, { packages: [] });

       const green = cli.fg.green;
       const dim = cli.fg.dim;

       cli.print(`${green("✓")} Initialized ${CLI_NAME} for project\n`);
     },
   });

   export default projectInit;
   ```

4. **`packages/cli/src/private/commands/project/init/init.spec.ts`** — tests:
   - Test: creates `.powerups/` folder
   - Test: writes `config.json` with `{ packages: [] }` (no harness)
   - Test: throws `project_already_initialized` when folder exists
   - Test: config.json has no harness field

### Auto-discovery

**File:** `packages/cli/src/commands/index.ts`

- No changes needed. The auto-discovery scans `src/commands/` for files. Adding `project.ts` there is sufficient. The `pack.ts` pattern confirms this works for command groups.

---

## Phase 8: CLI Wiring & Misc

### `packages/cli/src/bin.ts`

Update examples:
```ts
examples: [
  `$ ${CLI_CMD} init`,
  `$ ${CLI_CMD} init claude`,
  `$ ${CLI_CMD} project init`,
  `$ ${CLI_CMD} update`,
  `$ ${CLI_CMD} install npm:my-package`,
  `$ ${CLI_CMD} install npm:my-package -l`,
  `$ ${CLI_CMD} add my-package`,
  `$ ${CLI_CMD} pack create my-package`,
  `$ ${CLI_CMD} create --pack=my-package -t=multi-use -n=my-power -d="..."`,
  `$ ${CLI_CMD} pack move my-package global`,
  `$ ${CLI_CMD} find -q="summarize a pdf"`,
  `$ ${CLI_CMD} info my-power`,
  `$ ${CLI_CMD} use my-power --var name=foo`,
  `$ ${CLI_CMD} doctor`,
],
```

### `packages/cli/src/private/constants.ts`

- Add a harness fingerprints map for use by `detectHarnesses` (optional, helps maintainability):
  ```ts
  import { homedir } from "node:os";
  import path from "node:path";

  // ... existing exports ...

  /** Global harness fingerprint paths for detection. */
  export const HARNESS_FINGERPRINTS: Record<string, string> = {
    claude: path.join(homedir(), ".claude"),
    pi: path.join(homedir(), ".pi", "agent"),
    opencode: path.join(homedir(), ".config", "opencode"),
    codex: path.join(homedir(), ".codex"),
  };
  ```
  This is optional — detect.ts can hardcode the paths. But centralizing them in constants is cleaner. **Decision: add to constants.**

### `packages/cli/src/private/errors/doctorErrors.ts`

- Read and check if `not_initialized` references `pup init`. Update to `pup project init` if the doctor checks for local `.powerups` folder. Looking at the doctor code, it checks `mainFolder = root.append('/${MAIN_FOLDER}')` and throws `doctorErrors.not_initialized()`. This is a local project check, so update the message to `pup project init`.

---

## Phase 9: Test Updates

All test files that reference `harness` in config fixtures need updating. Here's the complete list:

### `private/commands/init/init.spec.ts` — Major rewrite

The init command is now global. Tests must:
- Use `GLOBAL_ROOT` or mock the home directory. Since tests use `context.root` to set the test directory, and init now uses `GLOBAL_ROOT` (hardcoded to `~/.powerups`), tests need a way to override the global root.
- **Problem:** The current test pattern passes `context: { root: testRoot }` to override the project root. But init now targets `GLOBAL_ROOT` which is `path.join(homedir(), MAIN_FOLDER)` — a hardcoded path that can't be overridden via context.
- **Solution:** Add a `context.globalRoot` option that init uses instead of `GLOBAL_ROOT`:
  ```ts
  const globalRoot = context?.globalRoot
    ? fs.ref(context.globalRoot)
    : fs.ref(GLOBAL_ROOT);
  ```
  And for scaffold, the home dir would be `context?.globalRoot ? fs.ref(context.globalRoot).directory : fs.ref(homedir())`.
  Actually, simpler: `context?.homeDir` for the scaffold target, and `context?.globalRoot` for the config/store root. Or just use `context?.homeDir` and derive global root from it.
  **Best approach:** Add `context?.homeDir` that, when set, overrides `homedir()` in both init and detectHarnesses. The global root is `path.join(homeDir, MAIN_FOLDER)`.
  ```ts
  // In init:
  const homeDir = context?.homeDir
    ? fs.ref(context.homeDir)
    : fs.ref(homedir());
  const globalRoot = homeDir.append(`/${MAIN_FOLDER}`);
  ```
  This way tests can set `context: { homeDir: testRoot }` and everything operates within the test directory.

- Update all test cases:
  - Remove `subcommands` for harness detection tests (detection is now global, based on `~/.claude` etc. — use `homeDir` + create `.claude` in test dir).
  - Remove tests for `multiple_harnesses_detected` (no longer an error).
  - Remove tests for `dry_folder_exists` → replace with `global_already_initialized`.
  - Remove `skipGlobal` from all context objects.
  - Update config tests: no `harness` field in config.json.
  - Update scaffold tests: check that files are written to the `homeDir`-based paths.
  - Test multi-harness: create both `.claude` and `.pi` in test home dir, verify both get scaffolded.

### `private/commands/update/update.spec.ts` — Major rewrite

- `setup()` helper currently calls `init.run()` to create local `.powerups`. Now init is global, so `setup()` needs to call init with `context: { homeDir: testRoot }`.
- Update tests:
  - `update regenerates skill files` — now checks global paths (within `homeDir`).
  - Remove `update --harness overrides config and persists` — no config persistence.
  - Remove `update fails when no config and no --harness` — no config read.
  - Remove `update succeeds with --harness when no config exists` — no config write.
  - Remove `update does not overwrite config` — no config interaction.
  - `update fails when not initialized` → checks for `global_not_initialized` instead of `main_folder_not_found`.
  - Add test: `update scaffolds to all detected harnesses`.
  - Add test: `update with --harness scaffolds only to that harness`.

### `private/commands/install/install.spec.ts`

- Update `reset()` — currently creates `.powerups` in testRoot. Now:
  - For local install tests: create `.powerups` (simulates `project init`).
  - For global install tests: create `~/.powerups` structure in testRoot (simulates `init`). Actually, install uses `GLOBAL_ROOT` which is hardcoded. Same problem as init — need `context.homeDir` or `context.globalRoot` override.
  - **Decision:** Add `context.homeDir` to install command too. When set, `GLOBAL_ROOT` is `path.join(homeDir, MAIN_FOLDER)`.
  ```ts
  const homeDir = context?.homeDir ?? homedir();
  const globalRoot = fs.ref(path.join(homeDir, MAIN_FOLDER));
  const isLocal = ...;
  const storeRoot = isLocal ? root.append(`/${MAIN_FOLDER}`) : globalRoot;
  ```
  Update guards to use `globalRoot` instead of `fs.ref(GLOBAL_ROOT)`.

### `private/commands/add/add.spec.ts`

- Remove `harness` from config fixtures.
- Add test: `add throws project_not_initialized when no .powerups folder`.
- Keep existing tests (add still works the same when config exists).

### `private/commands/validate/validate.spec.ts`

- Remove `harness` from config fixtures.
- Remove tests that check for `main_folder_not_found` when `.powerups` doesn't exist.
- Add test: `validate works without local .powerups (global fallback)`.
- Add test: `validate throws not_initialized when neither config exists`.

### `private/commands/info/info.spec.ts`

- Remove `harness` from config fixtures.
- Remove tests that check for `main_folder_not_found`.
- Add test: `info works without local .powerups (global fallback)`.

### `private/commands/use/use.spec.ts`

- Remove `harness` from config fixtures.
- Update error test: `main_folder_not_found` message now says `project init`.

### `private/commands/list/list.spec.ts`

- Remove `harness` from config fixtures.
- Add test: `list filters out globally-registered packages`.

### `private/commands/doctor/doctor.spec.ts`

- Remove `harness` from config fixtures.
- Update error message check if it tests for `not_initialized`.

### `private/commands/create/create.spec.ts`

- Remove `harness` from config fixtures (line 391: `harness: "claude"` → remove).

### `private/commands/find/find.spec.ts`

- Remove `harness` from config fixtures (line 72: `harness: "claude"` → remove).

### `private/commands/pack/create.spec.ts`

- Remove `harness` from config fixtures (line 277: `harness: "claude"` → remove).

### `private/commands/pack/move.spec.ts`

- Remove `harness` from config fixtures (line 45: `harness: "claude"` → remove).

---

## Phase 10: Context Propagation — `homeDir` Support

Several commands now need to know the home directory for global operations, and tests need to override it. The cleanest approach is to add `homeDir` to the command context.

### Approach

The `context` object is already passed to all commands via `context?.root`. We add `context?.homeDir`:

1. **Commands that need `homeDir`:**
   - `init` — uses it for global root + scaffold target
   - `update` — uses it for global root + scaffold target
   - `install` — uses it for global root
   - `detectHarnesses` — receives it via options
   - `scaffold` — receives it as the `homeDir` parameter

2. **Commands that DON'T need `homeDir`:**
   - `project init` — purely local
   - `add` — purely local (resolves packages via `resolvePackage` which already checks both local and global stores using `GLOBAL_ROOT`)
   - `use` — purely local config
   - `validate`/`info` — uses `resolvePowerUp` with `fallbackToGlobal`, which calls `readGlobalConfig` using `GLOBAL_CONFIG_PATH`
   - `list` — calls `readGlobalConfig` using `GLOBAL_CONFIG_PATH`

   **Problem:** `validate`, `info`, and `list` call `readGlobalConfig()` which uses the hardcoded `GLOBAL_CONFIG_PATH`. For tests, this means they'd read from the real `~/.powerups/config.json`. This is the same issue as the current code (these commands already use `GLOBAL_ROOT` for store scanning). The existing tests handle this by not testing global fallback in unit tests, or by the test environment not having a `~/.powerups` folder.
   
   **Decision:** For now, accept that global fallback tests for validate/info/list may need to mock `GLOBAL_CONFIG_PATH` or skip those specific unit tests. The `resolvePowerUp` function's `readGlobalConfig` call can be made testable by adding an optional `globalConfigPath` parameter, but that adds complexity. **Simpler: add `homeDir` to context for all commands, and have `readGlobalConfig` accept an optional homeDir parameter.**
   
   Actually, the simplest approach that matches the existing pattern: `readGlobalConfig` already uses `GLOBAL_CONFIG_PATH` constant. We can make `readGlobalConfig` accept an optional override:
   ```ts
   export async function readGlobalConfig(homeDir?: string): Promise<Config | null> {
     const configPath = homeDir
       ? fs.ref(path.join(homeDir, MAIN_FOLDER, CONFIG_FILE))
       : fs.ref(GLOBAL_CONFIG_PATH);
     // ...
   }
   ```
   Then `resolvePowerUp` can pass `root` (when testing) or nothing (production). But `resolvePowerUp` receives `root` which is the project root, not the home dir. 
   
   **Final decision:** Keep it simple. For `resolvePowerUp`'s `fallbackToGlobal` path, use `readGlobalConfig()` with the hardcoded path (same as current behavior for global store access). Tests for the fallback path will need to either:
   - Create a real `~/.powerups/config.json` (not great for CI)
   - Accept that these are integration-level tests
   - Or: pass `homeDir` through context → resolvePowerUp → readGlobalConfig
   
   **Best approach for testability:** Add optional `homeDir` to the context object. Thread it through to `readGlobalConfig` calls where needed. This is the most consistent with the existing `context.root` pattern.

### Implementation

1. Add `homeDir?: string` to the context type (informally — it's `any` currently).
2. In `resolvePowerUp`, pass `options?.homeDir` to `readGlobalConfig`:
   ```ts
   export async function resolvePowerUp(
     root: FileRef,
     name: string,
     type?: PowerUpType,
     options?: { fallbackToGlobal?: boolean; homeDir?: string },
   ): Promise<ResolvedPowerUp>
   ```
3. In `validate` and `info`, pass `context?.homeDir` to resolvePowerUp options.
4. In `list`, pass `context?.homeDir` to `readGlobalConfig`.
5. In `readGlobalConfig`, accept optional `homeDir`:
   ```ts
   export async function readGlobalConfig(homeDir?: string): Promise<Config | null> {
     const basePath = homeDir
       ? path.join(homeDir, MAIN_FOLDER, CONFIG_FILE)
       : GLOBAL_CONFIG_PATH;
     const configPath = fs.ref(basePath);
     // ...
   }
   ```
6. In `addPackageToGlobalConfig`, similarly accept optional `homeDir`.
7. In `init` and `update`, use `context?.homeDir ?? homedir()` for the home directory.
8. In `install`, use `context?.homeDir ?? homedir()` for the global root.

This makes everything testable by setting `context: { root: testRoot, homeDir: testRoot }` in tests.

---

## Implementation Order

Execute phases in this order (each phase should be committed separately):

1. **Phase 1:** Config changes (`config.ts` + `config.spec.ts`)
2. **Phase 2:** Detection changes (`detect.ts` + `detect.spec.ts`)
3. **Phase 3:** Scaffold changes (`scaffold/index.ts`)
4. **Phase 4:** Error files (all error files)
5. **Phase 10:** Context `homeDir` support (`config.ts` readGlobalConfig, resolve-powerup.ts, constants.ts)
6. **Phase 6:** `resolvePowerUp` fallbackToGlobal (`resolve-powerup.ts` + `resolve-powerup.spec.ts`)
7. **Phase 5:** Command changes (init, install, add, update, use, validate, info, list)
8. **Phase 7:** New `project init` command
9. **Phase 8:** CLI wiring (`bin.ts`, `commands/index.ts` auto-discovery)
10. **Phase 9:** Test updates (all remaining spec files)

Phases 1–4 are foundational and can be done independently. Phase 10 must come before phase 6 (resolvePowerUp needs homeDir). Phase 5 depends on phases 1–4 and 6. Phase 7 depends on phase 1 (writeConfig) and 4 (projectErrors). Phase 8 depends on 7. Phase 9 depends on all prior phases.

---

## Risk Assessment

1. **`GLOBAL_ROOT` is hardcoded** — commands that use it can't be easily tested in isolation. The `homeDir` context approach (phase 10) mitigates this but requires threading the parameter through multiple layers.

2. **`readGlobalConfig` return type change** — changing from always-defined `{ packages: [] }` to `Config | null` is a breaking change for all callers. Must update all callers in the same commit.

3. **Install config registration change** — currently install always adds to project config. Changing to global-only (for global installs) means local projects won't see globally-installed packages in their config. This is intentional per the spec (you need `pup add` to register packages for a project).

4. **Test environment** — existing tests create `.powerups` in a `tmp/` directory under the project root. With global init, tests need to create `~/.powerups` or use `homeDir` override. The `homeDir` approach is essential for CI.

5. **`resolvePackage` still uses `GLOBAL_ROOT`** — the `resolvePackage` function (used by `add`) checks both local and global stores using `GLOBAL_ROOT`. This is unchanged by the spec and still works for production. For tests, `add` tests already work because they create packages in the local store.

6. **Codex global fingerprint** — `detect.ts` currently doesn't check for `~/.codex` globally. Adding it is new behavior. Make sure the path is correct.

---

## File Change Summary

### New files (5)
- `packages/cli/src/commands/project.ts`
- `packages/cli/src/private/commands/project/index.ts`
- `packages/cli/src/private/commands/project/init/index.ts`
- `packages/cli/src/private/commands/project/init/init.spec.ts`
- `packages/cli/src/private/errors/projectErrors.ts`

### Modified files (21)
- `packages/cli/src/private/utils/config.ts`
- `packages/cli/src/private/utils/config.spec.ts`
- `packages/cli/src/private/scaffold/detect.ts`
- `packages/cli/src/private/scaffold/detect.spec.ts`
- `packages/cli/src/private/scaffold/index.ts`
- `packages/cli/src/private/utils/resolve-powerup.ts`
- `packages/cli/src/private/utils/resolve-powerup.spec.ts`
- `packages/cli/src/private/commands/init/index.ts`
- `packages/cli/src/private/commands/init/init.spec.ts`
- `packages/cli/src/private/commands/install/index.ts`
- `packages/cli/src/private/commands/install/install.spec.ts`
- `packages/cli/src/private/commands/add/index.ts`
- `packages/cli/src/private/commands/add/add.spec.ts`
- `packages/cli/src/private/commands/update/index.ts`
- `packages/cli/src/private/commands/update/update.spec.ts`
- `packages/cli/src/private/commands/use/index.ts`
- `packages/cli/src/private/commands/use/use.spec.ts`
- `packages/cli/src/private/commands/validate/index.ts`
- `packages/cli/src/private/commands/validate/validate.spec.ts`
- `packages/cli/src/private/commands/info/index.ts`
- `packages/cli/src/private/commands/info/info.spec.ts`
- `packages/cli/src/private/commands/list/index.ts`
- `packages/cli/src/private/commands/list/list.spec.ts`
- `packages/cli/src/private/commands/doctor/doctor.spec.ts`
- `packages/cli/src/private/commands/create/create.spec.ts`
- `packages/cli/src/private/commands/find/find.spec.ts`
- `packages/cli/src/private/commands/pack/create.spec.ts`
- `packages/cli/src/private/commands/pack/move.spec.ts`
- `packages/cli/src/private/errors/initErrors.ts`
- `packages/cli/src/private/errors/updateErrors.ts`
- `packages/cli/src/private/errors/addErrors.ts`
- `packages/cli/src/private/errors/installErrors.ts`
- `packages/cli/src/private/errors/useErrors.ts`
- `packages/cli/src/private/errors/infoErrors.ts`
- `packages/cli/src/private/errors/createErrors.ts`
- `packages/cli/src/private/errors/doctorErrors.ts`
- `packages/cli/src/private/errors/powerErrors.ts`
- `packages/cli/src/private/constants.ts`
- `packages/cli/src/bin.ts`

### Touch count: ~39 files (5 new + 34 modified)