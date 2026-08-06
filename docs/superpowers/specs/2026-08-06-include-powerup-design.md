# Include Powerup Design

## Overview

The `include` step type in powerup instructions is broken — it references other
powerups by name but doesn't bundle their code. A built powerup that uses
`include` steps is not self-contained; it fails at runtime if the included
powerups aren't installed in the consumer's project.

This design replaces the `include` step type with an `includePowerup` helper
function from the SDK. The helper takes a child powerup's export (via
`defineInstructions`) plus a variable mapping, and returns an array of steps
that are spread into the parent's `steps` array. The child's steps become
regular steps in the parent's instructions, with template paths prefixed and
variable mappings attached.

At build time, `pup build` compiles the TypeScript, generates
`instructions.json`, and bundles included templates into `dist/_internal/`.
The built package is fully self-contained.

At runtime, the execution engine handles `variableMap` on steps (merging
mapped variables into a step-local scope before rendering) and `install` steps
(updating `package.json` and running the appropriate install command inline).
No worktrees — steps execute directly against the project root — but
atomicity is preserved through a clean-git-state requirement, a pre-flight
validation pass, and targeted revert on failure.

## SDK Changes

### `defineInstructions` helper

Replaces the `export default () => instructionsSchema.parse(instructions)`
pattern. Captures `import.meta.url` so `includePowerup` can resolve the child's
package directory at build time.

```typescript
function defineInstructions<const I extends Instructions>(
  instructions: I,
  source: string,
): { instructions: I; source: string }
```

- `const` type parameter captures literal types for variable names and step
  names, enabling type-safe `includePowerup` options
- `source` is `import.meta.url` — used by `includePowerup` to locate the
  child's package directory during the parent's build
- Returns a wrapper object `{ instructions, source }`, not raw `Instructions`

### `includePowerup` helper

Takes a child's `defineInstructions` export plus a variable mapping, returns
an array of steps to spread into the parent's `steps` array.

```typescript
function includePowerup<const I extends Instructions>(
  child: { instructions: I; source: string },
  options: {
    variables: { [K in I["variables"]["required"][number]]: string } & {
      [K in NonNullable<I["variables"]["optional"]>[number]]?: string;
    };
    excludeSteps?: I["steps"][number]["name"][];
    stepOverride?: Record<string, StepOverrideValue>;
    namespace?: string;
  },
): Step[]
```

- `variables`: **all required** child variable names are mandatory keys;
  **optional** child variable names are allowed as optional keys. (A mapped
  type over required keys alone would reject optional-variable mappings via
  excess-property checks.)
- `excludeSteps`: only step names that exist in the child's steps (literal
  union type from the `const` type parameter).
- `namespace`: disambiguates the inclusion (defaults to
  `child.instructions.name`). Used for the `_internal/<namespace>/` template
  prefix and the `<namespace>:<stepName>` step-name prefix. Pass an explicit
  namespace when including the same child twice (e.g. two subcommands) or when
  two children share a name.

What it does, per child step:

1. Filters out `excludeSteps` from `child.instructions.steps`
2. Applies `stepOverride` to remaining steps
3. Prefixes each step's `template` path with `_internal/<namespace>/` —
   **except** templates that already start with `_internal/` (transitive
   includes, see below); those keep their grandchild prefix
4. Renames each step to `<namespace>:<name>`
5. Attaches/composes `variableMap` — for steps that already carry one
   (transitive includes), the child's own entries come **last**:
   `{ ...options.variables, ...step.variableMap }`. Resolution is sequential
   (see runtime section), so parent mappings are resolved first and later
   grandchild mappings can reference them
6. Attaches `__source` (from `child.source`) to each step — used by build to
   locate template files, stripped from final `instructions.json`. Steps from
   transitive includes keep their original `__source` (the grandchild's), so
   each step always points at the package that owns its templates
7. Attaches `from: { name: child.instructions.name, singleUse: boolean }` to
   each step — persisted in `instructions.json`, used at runtime for
   single-use enforcement and manifest recording
8. Returns the array of steps (child's `install` steps flow through naturally)

### `StepOverrideValue` — hand-written SDK type

`stepOverrideValueSchema` is deleted from the zod schemas (it only existed to
support the old `include` step), but the `StepOverrideValue` **type** is still
needed by `includePowerup`. Define it by hand in the SDK, including an
`install` variant:

```typescript
export type StepOverrideValue =
  | { type: "create"; template: string; outputPath: string }
  | { type: "modify"; template: string; outputPath: string }
  | { type: "delete"; outputPath: string }
  | { type: "read"; path: string; as: string; jsonPath?: string; template?: string }
  | {
      type: "install";
      target?: string;
      dependencies?: string[];
      devDependencies?: string[];
      peerDependencies?: string[];
    };
```

### Schema changes

**Added:**

- `install` step type:
  ```typescript
  {
    type: "install",
    name: string,
    target?: string,          // supports {{variables}}
    dependencies?: string[],  // each entry supports {{variables}}
    devDependencies?: string[],
    peerDependencies?: string[],
  }
  ```
- `variableMap?: Record<string, string>` on `create`, `modify`, `delete`,
  `read`, **and `install`** step types — used at runtime to merge mapped
  variables into a step-local scope before rendering. Adding it to `install`
  matters: zod's default object mode *strips unknown keys*, so a `variableMap`
  attached by `includePowerup` to an install step would otherwise be silently
  discarded at validation time.
- `__source?: string` on step types — internal build metadata used to locate
  child template files, stripped from `instructions.json` by the build command
- `from?: { name: string; singleUse: boolean }` on step types — provenance of
  flattened child steps, persisted in `instructions.json` for single-use
  enforcement and manifest recording

**Removed:**

- `include` step type from the discriminated union
- `packageDependencies` field from `instructionsSchema`
- `stepOverride` and `excludeSteps` from the step schema (now live on
  `includePowerup` options, not in step data)
- `includeStepSchema`, `stepOverrideValueSchema`,
  `packageDependencyGroupSchema`, `packageDependencyGroupArraySchema`

**CLI duplicate schema deleted.** `packages/cli/src/private/schemas/instruction.ts`
is removed entirely; the CLI imports `instructionsSchema` and step types from
`@liolocs/powerups-sdk` everywhere. One schema, one source of truth.

## Package Structure

All shipped files go into `dist/`. The `files` field in `package.json` is
`["dist"]` — everything the consumer needs is in one folder.

```
my-powerup/
  package.json          (source — not published)
  index.ts              (source — not published)
  templates/            (source — not published directly)
  dist/                 <- everything that ships
    index.js            (compiled JS — for imports by parent packages)
    index.d.ts          (compiled types — REQUIRED, see build section)
    instructions.json   (generated by build — for pup use at runtime)
    templates/          (copied from root by build)
    _internal/          (bundled child templates — copied from deps by build)
      cli-command/
        templates/
          command.ts
```

```json
{
  "files": ["dist"],
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  }
}
```

The `powerup` property keeps pointing at the **TS entry** (`"instructions":
"index.ts"`); `pup build` reads it to find the entry. Runtime resolution
instead reads `dist/instructions.json` (see Runtime Changes).

### Child declared as devDependency

The parent declares included powerups as `devDependencies` (not
`dependencies`) — needed for building the parent, but not needed by consumers
since templates are bundled into `dist/_internal/`:

```json
{
  "devDependencies": {
    "cli-command": "file:../cli-command",
    "cli-sub-command": "file:../cli-sub-command"
  }
}
```

For internal packages, the `file:` protocol creates a symlink in
`node_modules/`, making the child available during the parent's build.

## Build Changes (`pup build`)

### tsup stays a devDependency; resolved from the consumer project

`tsup` remains in the CLI's `devDependencies` (for the CLI's own build) and is
**not** added to `dependencies` — pulling its whole tree (esbuild, rollup for
d.ts) into every installed CLI is too heavy for an author-time-only feature.

Instead, `pup build` lazily resolves tsup *from the powerup project being
built*, via `createRequire(<cwd>/package.json)`:

```typescript
const require = createRequire(cwd.append("/package.json").path);
const tsup = require("tsup"); // resolved from the powerup project's node_modules
```

If resolution fails, throw a friendly error:
`pup build requires tsup — add it as a devDependency of this powerup package
(npm i -D tsup)`.

The powerup scaffold template gains `tsup` as a devDependency so authored
powerups have it out of the box.

### Compilation config

- Entry: the TS file from the `powerup.instructions` property in
  `package.json` (`powerupPropertySchema`) — **not** hardcoded `index.ts`
- Output: `dist/index.js`, ESM format, all imports external (no bundling)
- **`dts: true`** — emits `dist/index.d.ts`. This is required: children's
  `exports.types` already points there, and without declaration files a parent
  importing the child gets `any`, which silently disables the `const`-generic
  literal typing that makes `includePowerup` type-safe
- The `import cliCommand from "cli-command"` in the compiled JS stays as a
  runtime import, resolved via the child's `exports` field

### Build order requirement

**Children must be built before parents** — the parent's compiled
`dist/index.js` imports the child's `dist/index.js`, and `_internal` templates
are copied from the child's `dist/`. Document this; `file:`/`link:` symlinked
children make rebuilds immediate (no reinstall needed).

### Build flow

1. **Compile** the entry TS file to `dist/index.js` (+ `dist/index.d.ts`)
   using tsup (ESM, external imports, no bundling, `dts: true`)
2. **Import** `dist/index.js` (compiled JS — works in plain Node.js) — gets
   `{ instructions, source }` from the `defineInstructions` default export
   - `import.meta.url` in the compiled JS is the URL of `dist/index.js` —
     `includePowerup` walks up to find `package.json` and resolve the package
     directory
3. **Validate** instructions with `instructionsSchema`
4. **Build-time validation** (replaces the deleted runtime `checkOutput`,
   since the `validate` command is being removed):
   - all referenced templates exist (own + `_internal` sources resolvable)
   - step names are unique (namespaces make this checkable post-flatten)
   - `_internal/<namespace>` collision check: two inclusions with the same
     namespace are a build error
   - variable availability: every `{{token}}` in an `outputPath`/`path` is
     either a declared parent variable, a previously-`read` variable, or a key
     of that step's own `variableMap` (mapped child names are valid *within*
     their step even though undeclared at the top level)
5. **Write** `instructions.json` to `dist/` (strip `__source` fields from
   steps; keep `from`, `variableMap`)
6. **Copy own templates** from `templates/` to `dist/templates/`
7. **Copy `_internal/` templates** — for each template path matching
   `_internal/<namespace>/<subpath>`:
   - Take the step's `__source` (the owning package's module URL — grandchild
     steps point at the grandchild, see transitive-includes note)
   - Resolve that package's directory from `__source` (walk up to find
     `package.json`)
   - Copy from **`<pkgDir>/dist/<subpath>`** — never from the source
     `templates/` folder, because published children ship only `dist/`
     (`files: ["dist"]`); copying from source would work for `file:` symlinks
     but break for npm-installed children
8. **Do NOT** publish `index.ts` or source `templates/` — only `dist/` ships

### Transitive includes (child includes grandchild)

Supported via three rules already stated above:

- templates already starting with `_internal/` are not re-prefixed
- `variableMap` is composed with parent entries first, child entries last
- `__source` stays attached per-step, so grandchild templates are copied from
  the grandchild's `dist/` directly (flattened, not nested under the child)

The grandchild must also be a `devDependency` of the parent (it's referenced
at the parent's build time for template copying, though not imported by the
parent's code).

### No backward compatibility for old export format

The old `export default () => instructionsSchema.parse(instructions)` pattern
is replaced. `pup build` expects the `defineInstructions` format only. No
migration handling needed.

## Runtime Changes

### New execution engine (replaces `executeSteps`)

No worktrees. Steps execute directly against the project root, guarded by a
clean-git-state requirement and a pre-flight pass (see Atomicity below).

```typescript
interface ExecuteStepsArgs {
  steps: Step[];
  variables: VariableResult;
  outputFolder: FileRef;   // the powerup's dist/ directory
  rootDir: FileRef;        // the project root
  isDryRun: boolean;
  isOverwrite: boolean;
  record: RunRecord;       // collects step outcomes + file changes
}

interface RunRecord {
  steps: { name: string; type: string; status: "applied" | "skipped-warning" | "skipped-already-applied"; from?: string }[];
  files: { path: string; action: "create" | "modify" | "delete" }[];
  totalCharacters: number; // rendered characters — accumulates for metrics
}
```

`record.totalCharacters` replaces the old `executeSteps` return value; the
`use` command passes it to `logRun` in step 10.
```

`record` replaces the old `changedFiles` array — it feeds both the revert
path (on failure) and the manifest (on success).

### Per-step variable resolution

When a step has `variableMap`, merge mapped variables into a step-local scope
before rendering. Resolution is **sequential and cumulative**, which is what
makes transitive-include mapping chains work:

```typescript
function resolveStepVariables(
  step: Step,
  variables: VariableResult,
): VariableResult {
  if (!step.variableMap) {
    return variables;
  }

  const stepVars = { ...variables };

  // earlier entries resolve first; later entries may reference them
  for (const [key, value] of Object.entries(step.variableMap)) {
    stepVars[key] = resolveTemplateString(value, stepVars);
  }

  return stepVars;
}
```

For each `create` / `modify` / `read` / `install` step: resolve `stepVars`
first, then use `stepVars` for template rendering, `outputPath` / `path` /
`target` / dependency-string resolution.

`read` steps set their result on the **parent** scope (not step-local) so
values propagate to subsequent steps. In dry-run mode, `read` steps don't read
anything — they set a placeholder (`variables[step.as] = step.as`), matching
current behavior, so downstream template rendering and path resolution still
work.

Note: `read`-produced variable names are **not** namespaced — a child's `read`
result lands in the parent scope under its `as` name. Two children with
identically-`as`'d reads (or a child `as` colliding with a parent variable)
shadow each other. Accepted limitation for now; powerup authors should pick
distinct `as` names (a linter rule can come later).

### `install` step — runs inline, dedup-aware

1. Resolve `target` and dependency strings through the step scope
2. Parse each dependency spec into `{ name, spec }`:
   `name = spec.slice(0, spec.lastIndexOf("@"))` when `lastIndexOf("@") > 0`,
   else the whole string (handles `@scope/name@^1.2.3`).
   Non-registry specs (`file:`, `link:`, `git+`) are used as-is with the
   trailing path ignored for name extraction
3. Read the target `package.json` (`rootDir/<target>/package.json` or
   `rootDir/package.json`; error if it doesn't exist)
4. **Skip-already-present:** any dependency whose name is already in the
   matching section is skipped with a warning
   (`"lodash already in dependencies — skipping"`). Parent and child
   installing the same package is handled by this same rule: whichever install
   step runs first writes it, the later one warns and skips. No global dedup
   registry needed
5. Write remaining dependencies into `package.json`
6. Detect the project's lock file:
   - `pnpm-lock.yaml` → `pnpm install`
   - `package-lock.json` → `npm install`
   - `yarn.lock` → `yarn install`
   - `bun.lockb` / `bun.lock` → `bun install`
   - **no lock file** → keep today's behavior: `package.json` is updated,
     print a warning that dependencies were not installed and to run an
     install command manually; continue
7. Run the appropriate install command. **On failure: warn and continue**
   (matches today's `applyDependencies` semantics; rendered templates don't
   depend on installed packages)
8. In dry-run mode: print what would be installed, what would be skipped, and
   which command would run

Record the step in `record.steps` with status `applied` (or `skipped-warning`
if every dependency was a skip).

### Template path resolution

- Own templates: `outputFolder/templates/foo.ts` → `dist/templates/foo.ts`
- Included templates: `outputFolder/_internal/<namespace>/templates/foo.ts`

Both resolve from `outputFolder` (the `dist/` directory).

Template files are `.ts` files. The `tsRunner` already handles importing `.ts`
templates in Node.js via `--experimental-strip-types` child process, and
natively in Bun/Deno.

### Atomicity: clean git state + pre-flight + targeted revert

Replaces the worktree mechanism with three cheaper guards:

1. **Clean-git-state requirement** (non-dry-run only). Before executing:
   - `verifyGitRepo(root)` (existing helper — kept, moved to a git util)
   - `git status --porcelain` must be empty. Otherwise throw
     `use_errors.working_tree_dirty()` ("commit or stash your changes before
     running pup use"). A clean tree is what makes revert-by-checkout safe.
2. **Pre-flight validation.** Before writing anything:
   - resolve every step's `outputPath`/`path` (with mapped variables)
   - verify every referenced template exists in `outputFolder`
   - collect **create-step** destination collisions: if a create target exists
     and `--overwrite` isn't set, list all conflicts and fail *before* any
     write. (`--overwrite` applies only to create steps, matching current
     `destination_file_exists` semantics. A modify/delete target *existing* is
     the normal case — existence of modify/delete targets is checked at
     execution time with the current warn-and-skip behavior, not pre-flight.)
   - **Deferral for `read`-produced variables:** a step's `outputPath` may
     reference a variable produced by an earlier `read` step, which doesn't
     exist yet at pre-flight time. If a resolved path still contains `{{`
     tokens after `resolveTemplateString`, skip that step's collision check in
     pre-flight and check it at execution time instead. The template-existence
     and own-namespace checks still run for every step.
3. **Targeted revert on failure.** The run record tracks created, modified,
   and deleted paths as they're applied (existence checked before each write —
   replaces the old worktree-based classification). On a thrown error:
   - created files → delete
   - modified/deleted files → `git checkout -- <path>` (restores HEAD)
   - `package.json` / lockfile touched by `install` steps → same restore
   - `node_modules` changes cannot be reverted — print a notice suggesting
     re-running the install command if the tree looks wrong
   - the reverted run is **not** recorded in the manifest

### Single-use enforcement (via manifest)

The manifest doubles as the single-use registry (format below).

- **Top-level single-use powerups:** before executing, if
  `instructions.type === "single-use"` and `manifest.jsonl` already contains a
  successful entry with the same powerup name, refuse the run with an error.
- **Included single-use powerups:** flattened steps carry
  `from: { name, singleUse }`. Before executing, any step whose
  `from.singleUse` is true and whose `from.name` already appears in the
  manifest is skipped and recorded with status `skipped-already-applied`.
  Everything else runs normally.
- **Recording:** on success, append one entry for the parent powerup **plus
  one entry per included powerup** (built from the `from` groups among applied
  steps). This keeps the check uniform — "an entry with powerup name X
  exists" — whether the powerup ran standalone or as an inclusion, so an
  included single-use powerup is blocked from running standalone later, and
  vice versa.
- Skipped-due-to-warning steps are recorded with `skipped-warning` so the
  manifest faithfully reflects what actually ran.

### Manifest: `.powerups/manifest.jsonl`

Append-only JSON Lines (one entry per powerup per run). JSONL over `.json`
because runs are purely append events — no read-modify-write of a growing
array, no rewrite of the whole file per run, corruption isolated to one line,
and it matches the existing `metrics.jsonl` precedent in this repo. On read,
unparseable lines are skipped with a warning rather than failing the run. If
every step of a run is skipped (e.g. the only steps came from an
already-applied single-use inclusion), the run is treated as a no-op: a
message is printed and no manifest entry is appended.

```json
{
  "powerup": "cli-command",
  "package": "cli-with-sub-command",
  "version": "1.0.0",
  "location": "local",
  "type": "multi-use",
  "timestamp": "2026-08-06T12:00:00.000Z",
  "variables": { "commandName": "greet", "...": "..." },
  "steps": [
    { "name": "errors", "type": "create", "status": "applied" },
    { "name": "barrel", "type": "create", "status": "applied" }
  ],
  "files": [
    { "path": "packages/cli/src/private/commands/greet/index.ts", "action": "create" }
  ]
}
```

- Parent runs record the parent's variables and the full step list (including
  namespaced child steps); included-powerup entries record their own step
  subset with plain (de-namespaced) names.
- `file` actions are `create` | `modify` | `delete`, classified by existence
  check before each write.
- `installed` dependencies may be added to the entry later; not required for v1.

This replaces `applied-manifest.ts` (`recordApplication` /
`readAppliedManifest`) and the applied-manifest schema.

### Simplified `use` command

```
1. Extract name, locate .powerups folder
2. Resolve powerup → package dir; outputFolder = <packageDir>/dist
   - error clearly if dist/instructions.json is missing ("run pup build")
   - (the powerup property keeps pointing at the TS entry for pup build;
     runtime never reads it)
3. Load & validate instructions.json with the SDK schema
4. Extract & validate variables
5. Single-use check against .powerups/manifest.jsonl (top-level + per-step)
6. Non-dry-run: verify git repo + clean working tree
7. Pre-flight: resolve paths, check templates, check collisions
8. Execute steps directly against project root (recording outcomes)
   - create/modify/delete/read: write/read files
   - install: update package.json + run install inline (dedup-aware)
   - on failure: targeted revert, no manifest write
9. Append manifest entries (parent + each included powerup)
10. Log metrics
```

No worktree creation, no file copying, no separate dependency collection. The
runtime `checkOutput` step is gone (the `validate` command is deleted;
equivalent checks are now build-time — see Build flow step 4).

## Obsolete Code (to delete)

| File / Symbol | Why obsolete |
|---|---|
| `packages/cli/src/private/schemas/instruction.ts` (entire file) | Duplicate schema — SDK schema is the single source of truth; CLI imports from `@liolocs/powerups-sdk` |
| `packages/cli/src/private/commands/info/` (entire command) | Walks `include` steps recursively with `fromInclude` attribution — model no longer exists. Deleted; recreated later against flattened instructions + manifest |
| `packages/cli/src/private/commands/validate/` (entire command) | Built on include-tree validation. Deleted; validation moves into `pup build` (build flow step 4) |
| `packages/cli/src/private/utils/check-output.ts` (+ spec) | Only consumer was `use`/`validate`; rules superseded by build-time validation + `variableMap` semantics |
| `packages/cli/src/private/utils/validate-output.ts` (+ spec) | Entire file is include/suboutput-tree walking |
| `packages/cli/src/private/utils/applied-manifest.ts` (+ applied schema) | Replaced by `.powerups/manifest.jsonl` writer |
| `createWorktree`, `removeWorktree`, `copyChangedFiles`, `ChangedFile`, `Worktree` in `worktree.ts` | No worktrees (atomicity via clean-state + revert) |
| `worktree.ts` remainder | Keep `verifyGitRepo` — move it to a new `#utils/git.ts` alongside a `ensureCleanTree` helper shelling out to `git status --porcelain` |
| `include` case in `execute-steps.ts` | Replaced by `includePowerup` producing regular steps |
| `collectDependencies` in `dependencies.ts` | Install steps run inline — no recursive walk |
| `applyDependencies` in `dependencies.ts` | Logic moves into the `install` step handler |
| `detectPackageManager` in `dependencies.ts` | Logic absorbed into `install` step handler |
| `packageDependencies` field in the SDK schema | Replaced by `install` step type |
| `includeStepSchema` in the SDK schema | `include` step type removed |
| `stepOverrideValueSchema` | Replaced by hand-written `StepOverrideValue` type in the SDK |
| `packageDependencyGroupSchema` / `packageDependencyGroupArraySchema` | Replaced by `install` step schema |
| `worktreeRoot` / `outputsFolder` / `changedFiles` params in `executeSteps` | Replaced by `record: RunRecord` |
| Special dependency block in `use/index.ts` (both dry-run and post-run paths) | Install steps handled inline by execution engine |
| `use_errors.git_repo_required` | **KEEP — not obsolete.** Still thrown when the project isn't a git repo (atomicity requirement). Add `use_errors.working_tree_dirty` |
| `dist/` output only containing `instructions.json` + templates | `dist/` now also contains compiled `index.js` + `index.d.ts` |
| `exports` pointing to `./dist/index.js` without compilation | `pup build` now compiles with tsup |
| Function wrapper pattern in all powerup `index.ts` files | Replaced by `defineInstructions` |

Not deleted but updated: `packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts`
(and `get-package-deps.ts` where relevant) — these emit `packageDependencies`
into generated instructions today; they must emit `install` steps instead.

## Powerup Updates

### Child powerups (`cli-command`, `cli-sub-command`)

`package.json` — add `tsup` devDependency and keep the existing `exports`:

```json
{
  "files": ["dist"],
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "devDependencies": {
    "@liolocs/powerups-sdk": "link:../../packages/sdk",
    "tsup": "^8.5.1"
  }
}
```

`index.ts` — replace `export default () => instructionsSchema.parse(instructions)`
with:
```typescript
export default defineInstructions(instructions, import.meta.url);
```

### Parent powerup (`cli-with-sub-command`)

`package.json`:
```json
{
  "files": ["dist"],
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "devDependencies": {
    "@liolocs/powerups-sdk": "link:../../packages/sdk",
    "tsup": "^8.5.1",
    "cli-command": "file:../cli-command",
    "cli-sub-command": "file:../cli-sub-command"
  }
}
```

`index.ts`:
```typescript
import { defineInstructions, includePowerup, type Instructions } from "@liolocs/powerups-sdk";
import cliCommand from "cli-command";
import cliSubCommand from "cli-sub-command";

const instructions: Instructions = {
  name: "cli-with-sub-commands",
  type: "multi-use",
  description: "Scaffold a CLI with subcommands",
  variables: {
    required: [
      "commandName",
      "description",
      "subcommandName",
      "subcommandDescription",
      "subcommandFlags",
      "subcommandErrorCases",
    ],
    optional: ["errorCases"],
  },
  intent: [
    "create a new command and perhaps subcommands for a CLI command",
    "scaffold a command and subcommands with flags and error handling",
    "combined command and subcommands",
  ],
  steps: [
    {
      type: "create",
      name: "parent-command.ts",
      template: "templates/parent-command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    ...includePowerup(cliCommand, {
      namespace: "command",
      variables: {
        commandName: "{{commandName}}",
        description: "{{description}}",
        flags: "[]",
        errorCases: "{{errorCases}}",
      },
      excludeSteps: ["command", "spec"],
    }),
    ...includePowerup(cliSubCommand, {
      namespace: "subcommand",
      variables: {
        parentCommand: "{{commandName}}",
        subcommandName: "{{subcommandName}}",
        description: "{{subcommandDescription}}",
        flags: "{{subcommandFlags}}",
        errorCases: "{{subcommandErrorCases}}",
      },
      excludeSteps: ["modify-index"],
    }),
  ],
};

export default defineInstructions(instructions, import.meta.url);
```

### Bugs in the old format that this design fixes

Two latent bugs in the current `cli-with-sub-command/index.ts` confirm the
`include` flow was never exercised end-to-end:

1. `excludeSteps: ["command.ts", "spec.ts"]` but `cli-command`'s actual step
   names are `"command"` and `"spec"` (no `.ts` extension) — the excludes never
   matched. With literal type enforcement on `excludeSteps`, the valid values
   are `"command" | "errors" | "spec" | "barrel"`, so `"command.ts"` is a
   compile error.
2. The second include references `name: "cli-subcommand"` but the
   folder/package is `cli-sub-command` — the include never resolved at
   runtime. In the new design the name comes from
   `child.instructions.name` via the actual import, so this class of bug is
   impossible.

## Affected Packages

| Package | Changes |
|---|---|
| `@liolocs/powerups-sdk` | Add `defineInstructions`, `includePowerup`, hand-written `StepOverrideValue`; update schema (add `install` step, `variableMap`, `__source`, `from`; remove `include` step, `packageDependencies`) |
| `@liolocs/powerups-cli` | Overhaul build command (tsup compilation from `powerup` property entry, `dts: true`, lazy tsup resolution, dist bundling + build-time validation); overhaul execution engine (no worktrees, `variableMap`, inline dedup-aware `install`, clean-state + pre-flight + targeted revert); manifest.jsonl writer replacing applied-manifest; single-use enforcement incl. included powerups; delete `info`/`validate` commands, duplicate instruction schema, check-output, validate-output; keep `verifyGitRepo` via new git util |
| `.powerups/_internal/cli-command` | `defineInstructions`; `package.json` updates (files/exports, tsup devDep) |
| `.powerups/_internal/cli-sub-command` | Same as cli-command |
| `.powerups/_internal/cli-with-sub-command` | `includePowerup` + `defineInstructions`; add child + tsup devDependencies |

## Open trade-offs (acknowledged)

- **Git is required for non-dry-run `use`.** The old design required a git repo
  for worktrees; the new one requires git *and a clean tree* so failure can be
  reverted via checkout. Projects without git can only `--dry-run`.
- **Install steps are not fully revertable.** `package.json`/lockfile changes
  revert via git, but packages already installed into `node_modules` stay. The
  revert path prints a notice.
- **Deleted-then-recreated steps are recorded as create+delete pairs**;
  manifest consumers should not assume a file's last action is its only one.
