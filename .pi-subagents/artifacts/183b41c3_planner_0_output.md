# Implementation Plan: New Install Command

**Spec:** `docs/superpowers/specs/2026-08-21-install-command-new-design.md`
**Branch:** `feat/new-system-install`

## Summary

Recreate the `pup install` command from scratch, following the conventions established by the new `create` and `build` commands. Extract two shared utilities (`get-validated-powerup-property` and `register-powerup`) for cross-command reuse. 18 new files, 3 modified files.

## Phases

### Phase 1: Error Codes (2 new files, 1 spec)

#### Step 1.1: Create `errors/sharedErrors.ts`

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { SINGULAR_NAME_FOR_CLI } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const shared_errors = error.coded({
  invalid_powerup_property: (detail: string) => {
    const errorText =
      `Invalid ${SINGULAR_NAME_FOR_CLI} property in package.json.\n` +
      `Expected an object with an "instructions" string field.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type SharedErrorCode = keyof typeof shared_errors;
export const SharedErrorCode = Object.fromEntries(
  Object.keys(shared_errors).map(k => [k, k]),
) as { [K in SharedErrorCode]: K };

export default shared_errors;
```

#### Step 1.2: Recreate `errors/installErrors.ts`

Remove `local_not_initialized` and `global_not_initialized`. Remove `internal_not_installable` old message referencing "pup pack" — update to reference `pup create`. Keep `global_internal_not_installable`, `missing_source`, `fetch_failed`, `not_a_powerups_package`. Update `not_a_powerups_package` to accept a `reason` parameter for specific failure context.

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, PACKAGE_JSON_KEYWORD_PROPERTY } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const install_errors = error.coded({
  missing_source: () => {
    const errorText =
      `Package source required.\n\nUsage: ${CLI_CMD} install <source> [flags]\n\n` +
      `Sources: npm:<package> | git:<url> | <https-url>.git`;
    return t`${errorBGText}${errorText}`;
  },

  internal_not_installable: (name: string) => {
    const errorText =
      `"${name}" is an internal package name. Internal packages are created with "${CLI_CMD} create", not installed.\n` +
      `Use npm:<name> or git:<url> to install from a remote source.`;
    return t`${errorBGText}${errorText}`;
  },

  global_internal_not_installable: (name: string) => {
    const errorText =
      `"${name}" is already available as a global internal package.\n` +
      `There is no need to install it.`;
    return t`${errorBGText}${errorText}`;
  },

  fetch_failed: (source: string, message: string) => {
    const errorText = `Failed to fetch ${source}: ${message}`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: (source: string, reason: string) => {
    const errorText =
      `${source} is not a valid powerups package.\n` +
      `${reason}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type InstallErrorCode = keyof typeof install_errors;
export const InstallErrorCode = Object.fromEntries(
  Object.keys(install_errors).map(k => [k, k]),
) as { [K in InstallErrorCode]: K };

export default install_errors;
```

#### Step 1.3: Create `errors/sharedErrors.spec.ts`

Tests:
1. "should include the parse detail in the error message" — throw `invalid_powerup_property("some detail")`, verify `error.code` equals `SharedErrorCode.invalid_powerup_property` and `error.message` includes "some detail"
2. "should reference the instructions field requirement" — verify `error.message` includes "instructions"

#### Step 1.4: Create `errors/installErrors.spec.ts`

Tests (follow the createErrors.spec.ts pattern):
1. "should include the source name in missing_source usage hint" — verify includes "install"
2. "should include the powerup name in internal_not_installable error" — verify includes the name and "pup create"
3. "should include the powerup name in global_internal_not_installable error" — verify includes the name
4. "should include the source and message in fetch_failed error" — verify includes both
5. "should include the source and reason in not_a_powerups_package error" — verify includes both

### Phase 2: Source Parsing (1 new file + 1 spec)

#### Step 2.1: Create `utils/install/parse-source/index.ts`

```ts
import { FOLDER_FOR_NPM_INSTALLED_PACKAGES, FOLDER_FOR_GIT_INSTALLED_PACKAGES } from "#constants";

export interface ParsedSource {
  type: "npm" | "git" | "internal";
  configEntry: string;
  storePath: string;
  cloneUrl?: string;
}

export default function parseSource(source: string): ParsedSource {
  if (source.startsWith("npm:")) {
    const packageName = source.slice(4);
    return {
      type: "npm",
      configEntry: source,
      storePath: `${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/${packageName}`,
    };
  }

  if (source.startsWith("git:")) {
    const rest = source.slice(4);
    return {
      type: "git",
      configEntry: source,
      storePath: `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/${rest}`,
      cloneUrl: `https://${rest}`,
    };
  }

  if (source.startsWith("https://") || source.startsWith("http://")) {
    const url = source.endsWith(".git") ? source.slice(0, -4) : source;
    const urlObj = new URL(url);
    const parts = urlObj.pathname.slice(1).split("/").filter(Boolean);
    const domain = urlObj.hostname;
    const owner = parts[0] ?? "";
    const repo = parts[1] ?? "";
    return {
      type: "git",
      configEntry: source,
      storePath: `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/${domain}/${owner}/${repo}`,
      cloneUrl: source,
    };
  }

  return {
    type: "internal",
    configEntry: source,
    storePath: source,
  };
}
```

#### Step 2.2: Create `utils/install/parse-source/index.spec.ts`

Tests:
1. "should parse an npm source with the package name and correct store path" — `parseSource("npm:@scope/pkg")` → type: "npm", configEntry: "npm:@scope/pkg", storePath: "npm/node_modules/@scope/pkg", no cloneUrl
2. "should parse a git shorthand source with the correct store path and https clone url" — `parseSource("git:github.com/owner/repo")` → type: "git", configEntry: "git:github.com/owner/repo", storePath: "git/github.com/owner/repo", cloneUrl: "https://github.com/owner/repo"
3. "should parse a git https source with .git suffix preserving the full url as config entry" — `parseSource("https://github.com/owner/repo.git")` → type: "git", configEntry: "https://github.com/owner/repo.git", storePath: "git/github.com/owner/repo", cloneUrl: "https://github.com/owner/repo.git"
4. "should parse a git https source without .git suffix" — `parseSource("https://github.com/owner/repo")` → type: "git", storePath: "git/github.com/owner/repo", cloneUrl: "https://github.com/owner/repo"
5. "should parse a bare name as internal type" — `parseSource("my-powerup")` → type: "internal", configEntry: "my-powerup"
6. "should parse an http git source" — `parseSource("http://gitlab.com/owner/repo.git")` → type: "git", storePath: "git/gitlab.com/owner/repo"

### Phase 3: Pre-install Validation (3 new files + 1 spec)

#### Step 3.1: Create `utils/install/check-for-pre-install-errors/check-source-was-passed.ts`

```ts
import install_errors from "#errors/installErrors";
import is from "@rcompat/is";

export default function checkSourceWasPassed(source?: string): void {
  if (is.undefined(source) || is.falsy(source)) {
    throw install_errors.missing_source();
  }
}
```

#### Step 3.2: Create `utils/install/check-for-pre-install-errors/check-not-internal.ts`

```ts
import install_errors from "#errors/installErrors";
import { readGlobalConfig, getPackageSource } from "#utils/config";

export default async function checkNotInternal({
  parsedType,
  name,
  homeDir,
}: {
  parsedType: "npm" | "git" | "internal";
  name: string;
  homeDir?: string;
}): Promise<void> {
  if (parsedType !== "internal") {
    return;
  }

  const globalConfig = await readGlobalConfig(homeDir);
  const alreadyRegistered = globalConfig?.packages.some(
    entry => getPackageSource(entry) === `internal:${name}`,
  ) ?? false;

  if (alreadyRegistered) {
    throw install_errors.global_internal_not_installable(name);
  }

  throw install_errors.internal_not_installable(name);
}
```

#### Step 3.3: Create `utils/install/check-for-pre-install-errors/index.ts`

```ts
import checkSourceWasPassed from "#utils/install/check-for-pre-install-errors/check-source-was-passed";
import checkNotInternal from "#utils/install/check-for-pre-install-errors/check-not-internal";

export default async function checkForPreInstallErrors({
  source,
  parsedType,
  name,
  homeDir,
}: {
  source?: string;
  parsedType: "npm" | "git" | "internal";
  name: string;
  homeDir?: string;
}): Promise<void> {
  checkSourceWasPassed(source);

  await checkNotInternal({ parsedType, name, homeDir });
}
```

#### Step 3.4: Create `utils/install/check-for-pre-install-errors/index.spec.ts`

Test setup: `testRoot` with `globalTestRoot` acting as `homeDir`. Helper to write global config with entries.

Tests:
1. "should throw missing_source when no source is passed" — call with `source: undefined`, expect `InstallErrorCode.missing_source`
2. "should throw internal_not_installable when a bare name is not in the global config" — call with `parsedType: "internal"`, `name: "my-pup"`, no global config, expect `InstallErrorCode.internal_not_installable`
3. "should throw global_internal_not_installable when a bare name is already registered in the global config" — write global config with `internal:my-pup`, call with `parsedType: "internal"`, `name: "my-pup"`, expect `InstallErrorCode.global_internal_not_installable`
4. "should not throw when source type is npm" — call with `parsedType: "npm"`, `name: "pkg"`, no throw
5. "should not throw when source type is git" — call with `parsedType: "git"`, `name: "repo"`, no throw

### Phase 4: Setup Powerup Dir (1 new file)

#### Step 4.1: Create `utils/install/setup-powerup-dir.ts`

```ts
import fs, { type FileRef } from "@rcompat/fs";
import path from "node:path";
import { homedir } from "node:os";
import { CLI_FOLDER_NAME, CONFIG_FILE_NAME } from "#constants";

export default async function setupPowerupDir({
  isLocal,
  projectRoot,
  homeDir,
}: {
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<{ root: FileRef; powerupDir: FileRef }> {
  const root = isLocal
    ? projectRoot
    : fs.ref(path.join(homeDir ?? homedir(), CLI_FOLDER_NAME));
  const powerupDir = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}`)
    : root;

  if (!(await fs.exists(powerupDir))) {
    await fs.create(powerupDir);
  }

  const configPath = powerupDir.append(`/${CONFIG_FILE_NAME}`);
  if (!(await fs.exists(configPath))) {
    await fs.write(configPath, JSON.stringify({ packages: [] }) + "\n");
  }

  return { root, powerupDir };
}
```

Note: For global case, `root` = `homeDir/.powerups` (the global root itself). For local case, `root` = `projectRoot`, `powerupDir` = `projectRoot/.powerups`.

### Phase 5: Fetch Package (3 new files + 2 specs)

#### Step 5.1: Create `utils/install/fetch-package/fetch-npm-package.ts`

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import {
  FOLDER_FOR_NPM_INSTALLED_PACKAGES,
  NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP,
  PACKAGE_JSON,
} from "#constants";
import install_errors from "#errors/installErrors";
import type { ParsedSource } from "#utils/install/parse-source/index";

async function ensureNpmStore(powerupDir: FileRef): Promise<FileRef> {
  const npmDir = powerupDir.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}`);
  await fs.create(npmDir);

  const pkgJsonPath = npmDir.append(`/${PACKAGE_JSON}`);
  if (!(await fs.exists(pkgJsonPath))) {
    await pkgJsonPath.writeJSON({
      name: NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP,
      private: true,
      dependencies: {},
    });
  }

  const gitignorePath = npmDir.append("/.gitignore");
  if (!(await fs.exists(gitignorePath))) {
    await gitignorePath.write("*\n!.gitignore\n");
  }

  return npmDir;
}

export default async function fetchNpmPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const packageName = parsedSource.configEntry.slice(4);
  const npmDir = await ensureNpmStore(powerupDir);
  const pkgJsonPath = npmDir.append(`/${PACKAGE_JSON}`);
  const pkgJson = await pkgJsonPath.json() as Record<string, any>;

  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }

  if (!pkgJson.dependencies[packageName]) {
    pkgJson.dependencies[packageName] = "latest";
  }

  await pkgJsonPath.writeJSON(pkgJson);

  try {
    cli.print(`Running npm install in ${npmDir.path}...\n`);
    const stdout = await io.run("npm install", { cwd: npmDir.path });
    if (stdout) cli.print(stdout);
  } catch (error_) {
    const message = typeof error_ === "string" ? error_ : String(error_);
    throw install_errors.fetch_failed(parsedSource.configEntry, message);
  }
}
```

#### Step 5.2: Create `utils/install/fetch-package/fetch-npm-package.spec.ts`

Tests (use `setupTestDir`/`cleanup` with `testRoot`):
1. "should create the npm store directory with package.json if it does not exist" — call with empty powerupDir, verify `npm/package.json` exists with correct structure
2. "should create a .gitignore in the npm store directory" — verify `npm/.gitignore` exists with `*\n!.gitignore\n` content
3. "should not overwrite an existing package.json in the npm store" — pre-create `npm/package.json` with existing deps, call fetchNpmPackage, verify existing deps preserved + new dep added
4. "should add the package to dependencies with latest if not already present" — verify after fetch that `dependencies[packageName]` equals `"latest"`

Note: These tests call `ensureNpmStore` behavior without running actual `npm install`. The test should create a mock or catch the `npm install` failure. Alternatively, test only the `ensureNpmStore` behavior by pre-seeding the directory and verifying file creation. For the `npm install` call, the test can verify the dependency was added to `package.json` before the install attempt (the install will fail in test env but the store setup is already verified). The test should use `throwsAsync` to catch the `fetch_failed` error from the failed `npm install`.

Actually, a better approach: test `ensureNpmStore` indirectly by testing the store creation + dependency addition, then let `npm install` fail and catch the error. The key assertions are about store setup, not the actual npm install.

#### Step 5.3: Create `utils/install/fetch-package/fetch-git-package.ts`

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import install_errors from "#errors/installErrors";
import type { ParsedSource } from "#utils/install/parse-source/index";

export default async function fetchGitPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const targetDir = powerupDir.append(`/${parsedSource.storePath}`);

  if (await fs.exists(targetDir)) {
    try {
      cli.print(`Updating ${parsedSource.configEntry}...\n`);
      await io.run("git pull", { cwd: targetDir.path });
    } catch (error_) {
      const message = typeof error_ === "string" ? error_ : String(error_);
      throw install_errors.fetch_failed(parsedSource.configEntry, message);
    }
  } else {
    try {
      cli.print(`Cloning ${parsedSource.configEntry}...\n`);
      await fs.create(targetDir.directory);
      await io.run(`git clone --depth 1 "${parsedSource.cloneUrl}" "${targetDir.path}"`);
    } catch (error_) {
      const message = typeof error_ === "string" ? error_ : String(error_);
      throw install_errors.fetch_failed(parsedSource.configEntry, message);
    }
  }
}
```

#### Step 5.4: Create `utils/install/fetch-package/fetch-git-package.spec.ts`

Tests (use a real local git repo for clone testing):
1. "should clone a git repository into the store path when the directory does not exist" — create a bare git repo at `sourceRepo`, call fetchGitPackage with cloneUrl pointing to it, verify target dir exists with repo content
2. "should run git pull when the target directory already exists" — clone first, then call again, verify no error (pull updates)
3. "should throw fetch_failed when the git clone fails" — use a nonexistent URL, expect `InstallErrorCode.fetch_failed`

Test setup: Create a local git repo with `git init`, add a file, commit. Use `file://` protocol for the clone URL. The `parsedSource` mock should have `storePath: "git/localhost/test-repo"` and `cloneUrl: "file:///path/to/source-repo"`.

#### Step 5.5: Create `utils/install/fetch-package/index.ts`

```ts
import type { FileRef } from "@rcompat/fs";
import type { ParsedSource } from "#utils/install/parse-source/index";
import fetchNpmPackage from "#utils/install/fetch-package/fetch-npm-package";
import fetchGitPackage from "#utils/install/fetch-package/fetch-git-package";

export default async function fetchPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  switch (parsedSource.type) {
    case "npm":
      return fetchNpmPackage({ powerupDir, parsedSource });
    case "git":
      return fetchGitPackage({ powerupDir, parsedSource });
    default:
      return;
  }
}
```

### Phase 6: Validate Installed Package (1 new file + 1 spec)

#### Step 6.1: Create `utils/validate/get-validated-powerup-property.ts`

```ts
import { powerupPropertySchema, type PowerupProperty } from "@liolocs/powerups-sdk";
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import shared_errors from "#errors/sharedErrors";

export default function getValidatedPowerupProperty(
  pkgJson: Record<string, unknown>,
): PowerupProperty {
  const result = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME_FOR_CLI]);

  if (!result.success) {
    const detail = result.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw shared_errors.invalid_powerup_property(detail);
  }

  return result.data;
}
```

Note: This uses `powerupPropertySchema` from `@liolocs/powerups-sdk` (the SDK's zod schema), NOT the old `schemas/package.ts` pema schema. The SDK schema is `{ instructions: string, compatibility?: Record }`.

#### Step 6.2: Create `utils/install/validate-installed-package.ts`

```ts
import fs, { type FileRef } from "@rcompat/fs";
import { PACKAGE_JSON, PACKAGE_JSON_KEYWORD_PROPERTY } from "#constants";
import install_errors from "#errors/installErrors";
import getValidatedPowerupProperty from "#utils/validate/get-validated-powerup-property";

export default async function validateInstalledPackage({
  packageDir,
  source,
}: {
  packageDir: FileRef;
  source: string;
}): Promise<void> {
  const pkgJsonPath = packageDir.append(`/${PACKAGE_JSON}`);

  if (!(await fs.exists(pkgJsonPath))) {
    throw install_errors.not_a_powerups_package(source, "package.json not found after install");
  }

  const pkgJson = await pkgJsonPath.json() as Record<string, unknown>;
  const keywords = pkgJson.keywords;

  if (!Array.isArray(keywords) || !keywords.includes(PACKAGE_JSON_KEYWORD_PROPERTY)) {
    throw install_errors.not_a_powerups_package(source, `Missing "${PACKAGE_JSON_KEYWORD_PROPERTY}" keyword in package.json`);
  }

  const distInstructionsPath = packageDir.append("/dist/instructions.json");
  if (!(await fs.exists(distInstructionsPath))) {
    throw install_errors.not_a_powerups_package(source, "Package has not been built — dist/instructions.json not found");
  }

  getValidatedPowerupProperty(pkgJson);
}
```

#### Step 6.3: Create `utils/install/validate-installed-package.spec.ts`

Test setup: Create `testRoot/tmp`, create package dirs with various `package.json` + `dist/instructions.json` configurations.

Tests:
1. "should throw not_a_powerups_package when package.json does not exist" — empty package dir, expect `InstallErrorCode.not_a_powerups_package`
2. "should throw not_a_powerups_package when the powerups-package keyword is missing" — package.json without keyword, expect `InstallErrorCode.not_a_powerups_package`
3. "should throw not_a_powerups_package when dist/instructions.json does not exist" — package.json with keyword but no dist/, expect `InstallErrorCode.not_a_powerups_package`
4. "should throw invalid_powerup_property when the powerups property is invalid" — package.json with keyword + dist/instructions.json but malformed `powerups` property, expect `SharedErrorCode.invalid_powerup_property`
5. "should not throw when the package is valid" — package.json with keyword + dist/instructions.json + valid `powerups` property, no throw

For test 5, the `powerups` property must match `powerupPropertySchema` from the SDK: `{ instructions: "some/path.ts" }`.

### Phase 7: Shared Register Powerup (1 new file, 1 modified, 1 spec)

#### Step 7.1: Create `utils/shared/register-powerup.ts`

```ts
import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

export default async function registerPowerup({
  configEntry,
  isLocal,
  projectRoot,
  homeDir,
}: {
  configEntry: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  if (isLocal) {
    await addPackageToConfig(projectRoot, configEntry);
  } else {
    await addPackageToGlobalConfig(configEntry, homeDir);
  }
}
```

#### Step 7.2: Delete `utils/create/register-powerup.ts` and update import in `commands/create/index.ts`

In `commands/create/index.ts`, change:
```ts
import registerPowerup from "#utils/create/register-powerup";
```
to:
```ts
import registerPowerup from "#utils/shared/register-powerup";
```

And update the call site to pass `configEntry` instead of `name`:
```ts
// Old:
await registerPowerup({ name: powerupName!, isLocal, projectRoot });
// New:
await registerPowerup({ configEntry: `internal:${powerupName!}`, isLocal, projectRoot });
```

Also delete `utils/create/register-powerup.spec.ts` (will be replaced by shared spec).

#### Step 7.3: Create `utils/shared/register-powerup.spec.ts`

Tests (follow the old register-powerup.spec.ts pattern but with `configEntry` param):
1. "should add the config entry to the local config.json when registering locally" — call with `configEntry: "internal:my-powerup"`, `isLocal: true`, verify `readConfig` includes entry
2. "should add the config entry to the global config.json when registering globally" — call with `configEntry: "npm:pkg"`, `isLocal: false`, `homeDir: testRoot.path`, verify `readGlobalConfig` includes entry
3. "should not duplicate the entry if already registered" — call twice, verify count = 1
4. "should do nothing if the local config.json does not exist" — remove config, call, no throw

### Phase 8: Update Build to Use Shared Validation (1 modified file)

#### Step 8.1: Update `utils/build/compile-instructions-file.ts`

Replace the private `getValidatedPowerupProperty` function with an import from the shared module:

```ts
// Remove:
import { type Instructions, powerupPropertySchema, type PowerupProperty } from "@liolocs/powerups-sdk";
// Add:
import { type Instructions, type PowerupProperty } from "@liolocs/powerups-sdk";
import getValidatedPowerupProperty from "#utils/validate/get-validated-powerup-property";
```

Remove the private `getValidatedPowerupProperty` function at the bottom of the file. Replace the call site:
```ts
// Old:
const validatedPowerup = await getValidatedPowerupProperty(pkgJson);
// New:
const validatedPowerup = getValidatedPowerupProperty(pkgJson);
```

Note: The shared function is synchronous (zod `safeParse` is sync), but the old function was `async`. The `await` is unnecessary but harmless — removing it is cleaner.

### Phase 9: Print Install Summary (1 new file)

#### Step 9.1: Create `utils/install/print-install-summary.ts`

```ts
import cli from "@rcompat/cli";

export default function printInstallSummary({
  source,
  isLocal,
  storeType,
  isDryRun,
}: {
  source: string;
  isLocal: boolean;
  storeType: "npm" | "git" | "internal";
  isDryRun: boolean;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const location = isLocal ? "local" : "global";

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would install ${source}\n`);
  } else {
    cli.print(`${green("✓")} Installed ${source}\n`);
  }

  cli.print(`  ${dim("location:")} ${location}\n`);
  cli.print(`  ${dim("store:")} ${storeType}\n`);
}
```

### Phase 10: Wire Up `install-new.ts` (1 modified file)

#### Step 10.1: Update `commands/install/install-new.ts`

```ts
import { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import { homedir } from "node:os";
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import parseSource from "#utils/install/parse-source/index";
import checkForPreInstallErrors from "#utils/install/check-for-pre-install-errors/index";
import setupPowerupDir from "#utils/install/setup-powerup-dir";
import fetchPackage from "#utils/install/fetch-package/index";
import validateInstalledPackage from "#utils/install/validate-installed-package";
import registerPowerup from "#utils/shared/register-powerup";
import printInstallSummary from "#utils/install/print-install-summary";

const dryRunFlag: Flag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
};

const localFlag: Flag = {
  name: "local",
  long: "local",
  short: "l",
  description: "Install to local project store instead of global",
};

const install = new Command({
  name: "install",
  description: `Install a ${SINGULAR_NAME_FOR_CLI} locally or globally`,
  flags: [dryRunFlag, localFlag],
  subcommands: [],
  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? await runtime.projectRoot();
    const isDryRun = is.defined(flags.dryRun);
    const isLocal = is.defined(flags.local);
    const homeDir = context?.homeDir ?? homedir();

    const source = subcommands?.[0];
    const parsedSource = parseSource(source!);

    await checkForPreInstallErrors({
      source,
      parsedType: parsedSource.type,
      name: source!,
      homeDir,
    });

    if (!isDryRun) {
      const { powerupDir } = await setupPowerupDir({
        isLocal,
        projectRoot,
        homeDir,
      });

      await fetchPackage({ powerupDir, parsedSource });

      await validateInstalledPackage({
        packageDir: powerupDir.append(`/${parsedSource.storePath}`),
        source: parsedSource.configEntry,
      });

      await registerPowerup({
        configEntry: parsedSource.configEntry,
        isLocal,
        projectRoot,
        homeDir,
      });
    }

    printInstallSummary({
      source: parsedSource.configEntry,
      isLocal,
      storeType: parsedSource.type,
      isDryRun,
    });
  },
});

export default install;
```

### Phase 11: Integration Spec (1 modified file)

#### Step 11.1: Rewrite `commands/install/install.spec.ts`

Replace the skeleton tests with working integration tests. Keep imports of `test`, `fs`, `runtime`, `install`, `InstallErrorCode`, `CLI_FOLDER_NAME`, `INSTALLED_FOLDER`, `createSimpleProjectForTest`, `createGlobalInternalPowerupForTest`.

Test setup:
- `testRoot` = `root.append("/tmp")`
- `globalTestRoot` = `root.append("/global-tmp")`
- `setupTestDir()` creates both, `cleanup()` removes both
- For global install tests, pass `context: { root: projectDir, homeDir: globalTestRoot.path }`
- For the `global_internal_not_installable` test, use `createGlobalInternalPowerupForTest` with `globalRoot: globalTestRoot` — this creates the powerup in the REAL global root (since `createGlobalInternalPowerupForTest` uses the old create command which writes to `GLOBAL_ROOT`). The test then passes `context: { root: projectDir, homeDir: globalTestRoot.path }` to the install command, so it checks `globalTestRoot/.powerups/config.json` for the internal entry. Since `createGlobalInternalPowerupForTest` writes to the REAL global config, not `globalTestRoot`, this test case needs a different approach.

Actually, re-reading the skeleton test: `createGlobalInternalPowerupForTest({ powerupName, globalRoot: globalTestRoot })` passes `globalTestRoot` as `context.root` to the old create command. The old create command uses `GLOBAL_ROOT` for non-local (ignoring `context.root`). So the powerup is created at the REAL `~/.powerups/installed/_internal/global-test-powerup/` and registered in the REAL `~/.powerups/config.json`.

For the install command's `checkNotInternal`, it reads `readGlobalConfig(homeDir)`. If `homeDir` is `globalTestRoot.path`, it reads `globalTestRoot/.powerups/config.json` — which does NOT contain `internal:global-test-powerup`. So the test would throw `internal_not_installable`, not `global_internal_not_installable`.

To fix this: the test should manually register the powerup in `globalTestRoot/.powerups/config.json` instead of using `createGlobalInternalPowerupForTest`. Or pass the real `homedir()` as `homeDir` (not `globalTestRoot.path`).

Best approach: Don't use `createGlobalInternalPowerupForTest`. Instead, manually set up `globalTestRoot/.powerups/config.json` with `{ packages: ["internal:global-test-powerup"] }`. This makes the test self-contained and deterministic.

Tests:
1. "should throw global_internal_not_installable when installing a global internal powerup locally" — set up `globalTestRoot/.powerups/config.json` with `internal:global-test-powerup`, pass `context: { root: projectDir, homeDir: globalTestRoot.path }`, expect `InstallErrorCode.global_internal_not_installable`
2. "should install a powerup from npm locally without errors" — `npm:@liolocs/powerup-hello-world` with `--local`, verify package dir exists + config entry added
3. "should install a powerup from npm globally without errors" — `npm:@liolocs/powerup-hello-world` without `--local` with `homeDir: globalTestRoot.path`, verify package dir exists + config entry added
4. "should install a powerup from git locally without errors" — `git:github.com/liolocs/powerup-hello-world` with `--local`, verify package dir exists + config entry added
5. "should install a powerup from git globally without errors" — `git:github.com/liolocs/powerup-hello-world` without `--local` with `homeDir: globalTestRoot.path`, verify package dir exists + config entry added
6. "should not fetch or register anything in dry-run mode" — any valid source with `--dry-run`, verify nothing installed + no config changes
7. "should throw missing_source when no source is passed" — empty subcommands, expect `InstallErrorCode.missing_source`
8. "should throw not_a_powerups_package when installing a non-powerups npm package" — `npm:lodash` with `--local`, expect `InstallErrorCode.not_a_powerups_package`

For the npm/git install tests that install globally (tests 3, 5), the global test root needs a `.powerups/config.json`. The `setupTestDir` should create `globalTestRoot/.powerups/config.json` with `{ packages: [] }`.

For the path assertions:
- npm local: `projectDir/.powerups/installed/npm/node_modules/@liolocs/powerup-hello-world`
- npm global: `globalTestRoot/.powerups/installed/npm/node_modules/@liolocs/powerup-hello-world`
- git local: `projectDir/.powerups/installed/git/github.com/liolocs/powerup-hello-world`
- git global: `globalTestRoot/.powerups/installed/git/github.com/liolocs/powerup-hello-world`

For the config assertions, read the config JSON and check `packages` includes the config entry:
- npm: `npm:@liolocs/powerup-hello-world`
- git: `git:github.com/liolocs/powerup-hello-world`

For test 8 (non-powerups package), `npm:lodash` is a real npm package without the `powerups-package` keyword. The install will succeed (npm fetch), but `validateInstalledPackage` will throw `not_a_powerups_package`. Note: this test makes a real network call to install lodash. It should be expected to take some time.

### Phase 12: Type Check, Run All Specs, Commit

#### Step 12.1: Run type check

```bash
cd packages/cli && npx tsc --noEmit 2>&1 | grep "error TS" | grep -E "install/|shared/register|validate/get-validated|sharedErrors|installErrors"
```

Verify 0 type errors in new files. Some type errors may appear in `commands/install/index.ts` (old command) if it references removed error codes — this is expected since the old command still exists.

#### Step 12.2: Run all new unit specs

```bash
npx proby src/private/errors/installErrors.spec.ts
npx proby src/private/errors/sharedErrors.spec.ts
npx proby src/private/utils/install/parse-source/index.spec.ts
npx proby src/private/utils/install/check-for-pre-install-errors/index.spec.ts
npx proby src/private/utils/install/fetch-package/fetch-npm-package.spec.ts
npx proby src/private/utils/install/fetch-package/fetch-git-package.spec.ts
npx proby src/private/utils/install/validate-installed-package.spec.ts
npx proby src/private/utils/shared/register-powerup.spec.ts
```

All should pass.

#### Step 12.3: Run integration spec

```bash
npx proby src/private/commands/install/install.spec.ts
```

Note: Tests 2-5 and 8 make real network calls (npm install / git clone). These may take 30-60 seconds each. Tests 1, 6, 7 are local-only and fast.

#### Step 12.4: Run existing create spec to verify no regressions

```bash
npx proby src/private/commands/create/create.spec.ts
npx proby src/private/utils/create/register-powerup.spec.ts
```

Wait — `register-powerup.spec.ts` was deleted in Step 7.2. The create spec should still pass since the import was updated.

#### Step 12.5: Commit

```bash
git add -A
git commit -m "feat: implement new install command with npm and git support

- Recreate installErrors.ts: remove local/global_not_initialized, update
  internal_not_installable message, add reason param to not_a_powerups_package
- New sharedErrors.ts: invalid_powerup_property for cross-domain validation
- New parse-source/index.ts: parse npm:, git:, https://.git, and bare names
- New check-for-pre-install-errors/: source passed, not internal (checks
  global config for existing internal powerups)
- New setup-powerup-dir.ts: creates .powerups/ + config.json if missing
- New fetch-package/: npm (with .gitignore) and git (clone/pull) fetchers
- New validate-installed-package.ts: keyword, dist, powerup property checks
- Extract get-validated-powerup-property.ts to utils/validate/ (shared
  with build command)
- Extract register-powerup.ts to utils/shared/ (shared with create command)
- Wire up install-new.ts with --dry-run and --local flags
- 8 integration tests + 6 unit spec files, all passing"
```

## File Summary

### New Files (18)

| # | Path | Type |
|---|------|------|
| 1 | `errors/sharedErrors.ts` | Error definitions |
| 2 | `errors/sharedErrors.spec.ts` | Spec |
| 3 | `errors/installErrors.spec.ts` | Spec |
| 4 | `utils/install/parse-source/index.ts` | Source parser |
| 5 | `utils/install/parse-source/index.spec.ts` | Spec |
| 6 | `utils/install/check-for-pre-install-errors/check-source-was-passed.ts` | Validation check |
| 7 | `utils/install/check-for-pre-install-errors/check-not-internal.ts` | Validation check |
| 8 | `utils/install/check-for-pre-install-errors/index.ts` | Orchestrator |
| 9 | `utils/install/check-for-pre-install-errors/index.spec.ts` | Spec |
| 10 | `utils/install/setup-powerup-dir.ts` | Directory setup |
| 11 | `utils/install/fetch-package/fetch-npm-package.ts` | npm fetcher |
| 12 | `utils/install/fetch-package/fetch-npm-package.spec.ts` | Spec |
| 13 | `utils/install/fetch-package/fetch-git-package.ts` | git fetcher |
| 14 | `utils/install/fetch-package/fetch-git-package.spec.ts` | Spec |
| 15 | `utils/install/fetch-package/index.ts` | Dispatcher |
| 16 | `utils/install/validate-installed-package.ts` | Package validator |
| 17 | `utils/install/validate-installed-package.spec.ts` | Spec |
| 18 | `utils/validate/get-validated-powerup-property.ts` | Shared validation |
| 19 | `utils/shared/register-powerup.ts` | Shared registration |
| 20 | `utils/shared/register-powerup.spec.ts` | Spec |
| 21 | `utils/install/print-install-summary.ts` | Summary output |

### Modified Files (4)

| # | Path | Change |
|---|------|--------|
| 1 | `errors/installErrors.ts` | Recreated — remove 2 old errors, update messages, add reason param |
| 2 | `commands/install/install-new.ts` | Wire up all components |
| 3 | `commands/install/install.spec.ts` | Rewrite with 8 working integration tests |
| 4 | `utils/build/compile-instructions-file.ts` | Use shared `getValidatedPowerupProperty` |
| 5 | `commands/create/index.ts` | Import `registerPowerup` from `#utils/shared/register-powerup`, pass `configEntry` |

### Deleted Files (2)

| # | Path | Reason |
|---|------|--------|
| 1 | `utils/create/register-powerup.ts` | Moved to `utils/shared/register-powerup.ts` |
| 2 | `utils/create/register-powerup.spec.ts` | Replaced by `utils/shared/register-powerup.spec.ts` |

### Total: 21 new files, 5 modified, 2 deleted

## Ordering Notes

- Phase 1 (errors) must come first — all other phases import from it
- Phase 2 (parse-source) must come before Phase 3 (pre-install checks need parsed type)
- Phase 4 (setup) can come anytime after Phase 1
- Phase 5 (fetch) depends on Phase 2 (ParsedSource type)
- Phase 6 (validate) depends on Phase 1 (sharedErrors) and Phase 6.1 (get-validated-powerup-property)
- Phase 7 (shared register) can come after Phase 1, but should come before Phase 10 (wire-up)
- Phase 8 (build update) depends on Phase 6.1
- Phase 9 (summary) is standalone, can come anytime
- Phase 10 (wire-up) depends on all previous phases
- Phase 11 (integration spec) depends on Phase 10
- Phase 12 (type check + commit) is last