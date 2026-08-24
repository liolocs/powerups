# New Install Command Design

## Overview

Recreate the `pup install` command from scratch following the conventions established by the new `create` and `build` commands. The install command fetches external powerup packages from npm or git and registers them in the local or global config.

## Source Formats

The install command accepts a source string as its first subcommand:

| Format | Type | Config Entry | Store Path | Clone URL |
|--------|------|---------------|------------|-----------|
| `npm:<package>` | npm | `npm:<package>` (as-is) | `installed/npm/node_modules/<package>` | — |
| `git:<domain>/<owner>/<repo>` | git | `git:<domain>/<owner>/<repo>` (as-is) | `installed/git/<domain>/<owner>/<repo>` | `https://<domain>/<owner>/<repo>` |
| `https://<domain>/<owner>/<repo>.git` | git | full URL (as-is) | `installed/git/<domain>/<owner>/<repo>` | the full URL |
| bare name | internal | — | — | — |

Bare names (no prefix) are classified as `internal` type and rejected — internal packages are created with `pup create`, not installed.

For git, the store path is derived by stripping the protocol and `.git` suffix, giving `<domain>/<owner>/<repo>`. The `git:` shorthand is converted to an `https://` clone URL internally, but stored in config with the `git:` prefix as-is.

No filtering (`--include`/`--exclude` flags or `#fragment` syntax) — one powerup per package.

## Parsed Source Descriptor

```ts
interface ParsedSource {
  type: "npm" | "git" | "internal";
  configEntry: string;
  storePath: string;
  cloneUrl?: string;
}
```

## Architecture

```
utils/install/
├── parse-source/
│   └── index.ts                 (+ spec)
├── check-for-pre-install-errors/
│   ├── check-source-was-passed.ts
│   ├── check-not-internal.ts
│   └── index.ts                 (+ spec)
├── fetch-package/
│   ├── fetch-npm-package.ts     (+ spec)
│   ├── fetch-git-package.ts     (+ spec)
│   └── index.ts
├── validate-installed-package.ts (+ spec)
├── setup-powerup-dir.ts
└── print-install-summary.ts

utils/validate/
└── get-validated-powerup-property.ts   (shared, extracted from build)

utils/shared/
└── register-powerup.ts                 (shared, extracted from create)

errors/
├── installErrors.ts                    (recreated)
└── sharedErrors.ts                      (new)
```

## Component Details

### 1. Source Parsing (`parse-source/parse-source.ts`)

Parses the source string into a `ParsedSource` descriptor.

- `npm:` prefix → type: `npm`, store path: `installed/npm/node_modules/<package>`, config entry: source as-is
- `git:` prefix → type: `git`, store path: `installed/git/<domain>/<owner>/<repo>`, clone URL: `https://<domain>/<owner>/<repo>`, config entry: source as-is
- `https://` or `http://` prefix (with `.git` suffix) → type: `git`, store path: `installed/git/<domain>/<owner>/<repo>` (strip protocol + `.git`), clone URL: source as-is, config entry: source as-is
- No prefix → type: `internal`

### 2. Pre-install Validation (`check-for-pre-install-errors/`)

Individual check files orchestrated by `index.ts`:

**`check-source-was-passed.ts`** — throws `missing_source` if no subcommand provided.

**`check-not-internal.ts`** — if `parsedSource.type === "internal"`:
- Read the global config using `readGlobalConfig(homeDir)` where `homeDir` comes from `context.homeDir ?? homedir()`
- Search `packages` array for an entry whose source (extracted via `getPackageSource`) equals `internal:<name>`
- If found → throw `global_internal_not_installable` ("already available")
- If not found → throw `internal_not_installable` ("use npm: or git: to install from remote source")

Receives `{ name, homeDir }`. Runs before `setupPowerupDir` — internal rejection doesn't depend on store state.

**`index.ts`** — orchestrator calling checks in order:
1. Source passed
2. Not internal

### 3. Setup Powerup Dir (`setup-powerup-dir.ts`)

Resolves and creates the install target, similar to `setupRoot` from the use command.

- If `--local`: `root` = `context.root ?? projectRoot`, `powerupDir` = `root/.powerups`
- If global: `root` = `context.homeDir ?? homedir()`, `powerupDir` = `root/.powerups`
- Creates `powerupDir` directory if missing
- Creates `powerupDir/config.json` with `{ packages: [] }` if missing
- Returns `{ root, powerupDir }`
- Skipped entirely in dry-run mode

### 4. Fetch Package (`fetch-package/`)

**`fetch-npm-package.ts`** — installs an npm package into the store:
- Ensures the npm store directory exists at `powerupDir/installed/npm/`
- Creates `package.json` with `{ name: "powerups", private: true, dependencies: {} }` if missing
- Creates `.gitignore` with `*\n!.gitignore` if missing
- Adds the package to `dependencies` with `"latest"` if not already present
- Runs `npm install` in the store directory
- On failure → throws `fetch_failed`

**`fetch-git-package.ts`** — clones or updates a git repository:
- Target: `powerupDir/installed/git/<domain>/<owner>/<repo>`
- If directory exists → `git pull` to update
- If not → `git clone --depth 1 <cloneUrl> <targetDir>`
- On failure → throws `fetch_failed`

**`index.ts`** — dispatcher routing to the correct fetcher based on `parsedSource.type`.

### 5. Validate Installed Package (`validate-installed-package.ts`)

Validates the fetched package is a legitimate powerups package:

1. `package.json` exists in the installed directory → otherwise `not_a_powerups_package`
2. `keywords` array contains `"powerups-package"` → otherwise `not_a_powerups_package`
3. `dist/instructions.json` exists → otherwise `not_a_powerups_package` ("package not built")
4. `getValidatedPowerupProperty(pkgJson)` succeeds → otherwise `invalid_powerup_property` from `sharedErrors`

Receives `{ packageDir, source }` where `packageDir` is the full path to the installed package and `source` is the original source string.

### 6. Shared: Get Validated Powerup Property (`utils/validate/get-validated-powerup-property.ts`)

Extracted from `compile-instructions-file.ts` as a shared function:

- Takes `pkgJson: Record<string, unknown>`
- Parses `pkgJson["powerups"]` with `powerupPropertySchema` from the SDK
- On failure → throws `sharedErrors.invalid_powerup_property` (includes parse error details)
- Returns `PowerupProperty`
- Build's `compile-instructions-file.ts` updated to use this shared function instead of its private copy

### 7. Shared: Register Powerup (`utils/shared/register-powerup.ts`)

Extracted from `utils/create/register-powerup.ts` as a shared function:

- Accepts `{ configEntry, isLocal, projectRoot, homeDir }`
- If `isLocal` → `addPackageToConfig(projectRoot, configEntry)`
- If global → `addPackageToGlobalConfig(configEntry, homeDir)`
- Create command calls with `configEntry: \`internal:${name}\``
- Install command calls with `configEntry: parsedSource.configEntry`
- Create's `utils/create/register-powerup.ts` removed, import switched to `#utils/shared/register-powerup`
- Skipped entirely in dry-run mode

### 8. Print Install Summary (`print-install-summary.ts`)

- Shows: ✓ icon, source string, location (local/global), store type (npm/git)
- In dry-run mode: prints what *would* be installed with a "dry run" indicator

## Error Codes

### `errors/installErrors.ts` (recreated)

| Error | When | Message |
|-------|------|---------|
| `missing_source` | No subcommand passed | "Package source required" + usage hint |
| `internal_not_installable` | Bare name, not in global config | "Use npm: or git: to install from remote source" |
| `global_internal_not_installable` | Bare name, already in global config | "Already available — no need to install" |
| `fetch_failed` | npm install or git clone/pull fails | "Failed to fetch {source}: {message}" |
| `not_a_powerups_package` | Missing keyword, missing dist, or missing package.json | "{source} is not a valid powerups package" + reason |

Removed from old: `local_not_initialized` and `global_not_initialized` (setup creates the directory).

### `errors/sharedErrors.ts` (new)

| Error | When | Message |
|-------|------|---------|
| `invalid_powerup_property` | `powerupPropertySchema` parse fails | "Invalid powerup property in package.json" + parse error details |

## Command Wire-up (`install-new.ts`)

**Flags:**
- `--dry-run` / `-dr` — print what would be installed, skip setup + fetching + registration
- `--local` / `-l` — install to local `.powerups/` instead of global `~/.powerups/`

**Action flow:**
1. Resolve project root from context
2. Parse source from `subcommands[0]` → `parsedSource`
3. Run pre-install checks:
   - `check-source-was-passed`
   - `check-not-internal`
4. If not dry-run:
   - `setupPowerupDir({ isLocal, projectRoot, homeDir })` → `{ root, powerupDir }`
   - `fetch-package` dispatcher `({ powerupDir, parsedSource })`
   - `validate-installed-package({ packageDir: powerupDir/<storePath>, source })`
   - `register-powerup({ configEntry: parsedSource.configEntry, isLocal, projectRoot, homeDir })`
5. `print-install-summary({ source, isLocal, storeType, isDryRun })`

Dry-run short-circuits after step 3 — skips setup, fetch, validate, and register entirely.

## Integration Tests

**Test setup:**
- `testRoot` = `projectRoot/tmp` — for local install tests
- `globalTestRoot` = `projectRoot/global-tmp` — acts as `homeDir` for global install tests
- `createSimpleProjectForTest` creates a project with `package.json` + git init
- Global install tests pass `context: { root: projectDir, homeDir: globalTestRoot.path }`

**Test cases:**

1. "should throw global_internal_not_installable when installing a global internal powerup locally"
2. "should install a powerup from npm locally without errors"
3. "should install a powerup from npm globally without errors"
4. "should install a powerup from git locally without errors"
5. "should install a powerup from git globally without errors"
6. "should not fetch or register anything in dry-run mode"
7. "should throw missing_source when no source is passed"
8. "should throw not_a_powerups_package when installing a non-powerups npm package"

**Global internal test powerup cleanup:**
The real `powerup-hello-world` is registered in `~/.powerups/config.json` as `internal:powerup-hello-world`. Before npm/git tests that install globally, unregister it from the global config to avoid conflicts. Re-register on cleanup using `addPackageToGlobalConfig`.

**Unit test files (co-located):**
- `parse-source.spec.ts` — tests all source format parsing (npm, git shorthand, git https, internal)
- `check-for-pre-install-errors/index.spec.ts` — tests source passed + not internal checks
- `fetch-package/fetch-npm-package.spec.ts` — tests npm store creation (package.json + .gitignore)
- `fetch-package/fetch-git-package.spec.ts` — tests clone + pull behavior
- `validate-installed-package.spec.ts` — tests keyword check, dist check, powerup property validation
- `sharedErrors.spec.ts` — tests `invalid_powerup_property` error