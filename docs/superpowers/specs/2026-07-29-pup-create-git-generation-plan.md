# Implementation Plan: `pup create` Git-Based Powerup Generation

**Spec:** `docs/superpowers/specs/2026-07-29-pup-create-git-generation-design.md`

All file paths are relative to `packages/cli/src/private/` unless noted otherwise.

---

## Phase 1: New Error Codes (`errors/createErrors.ts`)

**File:** `packages/cli/src/private/errors/createErrors.ts`

Add two new error codes to the existing `create_errors` object (keep all existing error codes — `main_folder_not_found`, `missing_type`, `already_exists`, `invalid_output_json`, `invalid_package_deps_json`, `missing_pack`, `pack_not_found` — they remain for use in edge cases and validation):

```ts
not_a_git_repo: () => {
  const errorText = `Working directory is not a git repository. Run "${CLI_CMD} create <name>" without --working-dir to create a blank ${SINGULAR_NAME}.`;
  return t`${errorBGText}${errorText}`;
},
package_not_initialized: () => {
  const errorText = `Could not determine package name from package.json. Pass --pack=<name> explicitly.`;
  return t`${errorBGText}${errorText}`;
},
```

Update the `CreateErrorCode` type union to include the new codes (the `Object.fromEntries` pattern already handles this automatically).

**No test changes needed** — error code tests are covered in the command-level and orchestrator-level spec files.

---

## Phase 2: Git Status Parsing (`utils/git/git-status.ts`)

**Files to create:**
- `packages/cli/src/private/utils/git/git-status.ts`
- `packages/cli/src/private/utils/git/git-status.spec.ts`

### 2.1 — Types

```ts
type GitChangeStatus = "new" | "modified" | "deleted" | "renamed" | "unknown";

type GitChange = {
  path: string;       // relative to project root (for outputPath)
  status: GitChangeStatus;
  rawStatus: string;  // the XY codes from porcelain output
};
```

Export the `GitChange` and `GitChangeStatus` types.

### 2.2 — Constants

Define the lockfile exclusion set:
```ts
const EXCLUDED_PATHS = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);
```

### 2.3 — Classification function

```ts
function classifyStatus(rawStatus: string): GitChangeStatus
```

Logic:
- `"??` → `"new"`
- `"A "`, `"AM"`, `" M"`, `"M "`, `"MM"` → `"modified"`
- `"D "`, `" D"`, `"AD"`, `"MD"` → `"deleted"`
- `"R "`, `"RM"`, `"C "` → `"renamed"`
- anything else → `"unknown"`

The `rawStatus` is the first 2 characters of each porcelain line. Note: `??` for untracked is a special case where both X and Y are `?`.

### 2.4 — Path exclusion function

```ts
function shouldExclude(path: string): boolean
```

Returns `true` if:
- Path starts with `.powerups/`
- The basename is in `EXCLUDED_PATHS`

### 2.5 — Main export

```ts
async function getGitStatus({
  workingDir,
  projectRoot,
}: {
  workingDir: FileRef;
  projectRoot: FileRef;
}): Promise<GitChange[]>
```

Logic:
1. Run `git status --porcelain -- "<workingDir.path>"` with `cwd: projectRoot.path`
   - If the command fails (non-zero exit), throw `create_errors.not_a_git_repo()`
2. Parse stdout line by line
3. For each non-empty line:
   - Extract `rawStatus` = first 2 characters
   - Extract the path: the remainder after the status codes and a space. Handle quoted paths (porcelain wraps paths with special chars in `"..."`). For renames (`R`/`C`), the format is `XY <path> -> <newpath>` — extract both paths and store the new path for the `GitChange.path`.
   - Convert the path from git-root-relative to project-root-relative: run `git rev-parse --show-toplevel` once (cache it) to get the git root, then compute `path.relative(projectRoot.path, path.join(gitRoot, gitRelativePath))`.
   - If the resulting path starts with `..` (outside project root), skip with a warning (collected but not included in the returned array — warnings are printed by the orchestrator).
   - If `shouldExclude(path)`, skip silently.
   - Classify status and push to the result array.
4. Return the array of `GitChange` objects.

### 2.6 — Spec file (`git-status.spec.ts`)

Use `@rcompat/test`. Set up a temp git repo in each test (pattern from `use.spec.ts`):
- Create a temp dir, `git init`, configure user, commit an initial file.
- Create/modify/delete files, run `getGitStatus`, assert results.

Test cases:
1. `??` (untracked file) → `{ status: "new" }`
2. ` M` (unstaged modification) → `{ status: "modified" }`
3. `M ` (staged modification) → `{ status: "modified" }`
4. `MM` (staged + unstaged modification) → `{ status: "modified" }`
5. ` D` (unstaged deletion) → `{ status: "deleted" }`
6. `D ` (staged deletion) → `{ status: "deleted" }`
7. `R ` (renamed) → `{ status: "renamed" }`
8. `.powerups/` path is excluded
9. `pnpm-lock.yaml` is excluded
10. `package-lock.json` is excluded
11. Empty git status output → empty array
12. Not a git repo → throws `not_a_git_repo` error (verify `CodeError.code`)
13. File outside project root → skipped (create a file in a sibling dir, verify it's not in results)

---

## Phase 3: Diff-to-Modifications Algorithm (`utils/git/diff-to-modifications.ts`)

**Files to create:**
- `packages/cli/src/private/utils/git/diff-to-modifications.ts`
- `packages/cli/src/private/utils/git/diff-to-modifications.spec.ts`

This is the most complex module. It is a **pure function** — no git commands, no filesystem access. It accepts strings and structured hunks, returns modifications and warnings.

### 3.1 — Types

```ts
type DiffLineType = "context" | "added" | "removed";

type DiffLine = {
  type: DiffLineType;
  content: string;  // the line content without the leading +/-/space prefix
};

type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

type AtomicEditType = "insertion" | "deletion" | "replacement";

type AtomicEdit = {
  type: AtomicEditType;
  // Lines before the edit (context lines immediately preceding the changed block within this hunk)
  contextBefore: string[];
  // Lines after the edit (context lines immediately following the changed block within this hunk)
  contextAfter: string[];
  // The removed lines (for deletion/replacement)
  removedLines: string[];
  // The added lines (for insertion/replacement)
  addedLines: string[];
  // Whether this edit is at the start of the file (no context before in any hunk before this)
  atFileStart: boolean;
  // Whether this edit is at the end of the file
  atFileEnd: boolean;
};

type GenerateModificationsResult = {
  modifications: Modification[];
  warnings: string[];
};
```

Import `Modification` from `#schemas/modification`.

### 3.2 — Parse hunks into atomic edits

```ts
function parseHunksIntoEdits(hunks: DiffHunk[]): AtomicEdit[]
```

For each hunk:
1. Walk through the hunk's `lines` array.
2. Accumulate context lines (type `"context"`) in a running buffer.
3. When encountering a contiguous block of `"added"` and/or `"removed"` lines:
   - If the block contains only `"added"` lines → `insertion`
   - If the block contains only `"removed"` lines → `deletion`
   - If the block contains both → `replacement`
   - The `contextBefore` is the accumulated context lines since the last edit (or hunk start).
   - The `contextAfter` is the context lines until the next edit block (or hunk end).
   - `atFileStart`: true if this is the first edit in the first hunk and there were no context lines before it in the hunk.
   - `atFileEnd`: true if this is the last edit in the last hunk and there are no context lines after it in the hunk.
4. Reset the context buffer after each edit to the `contextAfter` lines (they become `contextBefore` for the next edit).

### 3.3 — Count occurrences

```ts
function countOccurrences(haystack: string, needle: string): number
```

Count how many times `needle` appears in `haystack`. Use `haystack.split(needle).length - 1`.

### 3.4 — Generate modification for a single edit

```ts
function generateModificationForEdit({
  edit,
  preImage,
}: {
  edit: AtomicEdit;
  preImage: string;
}): { modification: Modification | null; warning: string | null }
```

Logic by edit type:

**Insertion:**
- If `atFileStart` → `{ where: "top", content: addedLines.join("\n") + "\n" }` (ensure trailing newline)
- If `atFileEnd` → `{ where: "bottom", content: addedLines.join("\n") + "\n" }`
- Otherwise, try the last context line before the edit as an `{ after }` anchor:
  - `anchor = contextBefore[contextBefore.length - 1] + "\n"`
  - If `countOccurrences(preImage, anchor) === 1` → `{ where: { after: anchor }, content: addedLines.join("\n") + "\n" }`
  - If not unique, try the first context line after the edit as a `{ before }` anchor:
    - `anchor = contextAfter[0]` (with trailing `\n`)
    - If unique → `{ where: { before: anchor }, content: ... }`
  - If neither is unique, escalate to **context envelope** (exact replacement):
    - Build a `where` string from `contextBefore[-1] + ... + contextAfter[0]` (enough context lines to be unique)
    - Build the `content` string as the same context with the inserted lines in between
    - If still not unique after expanding to the max context limit (10 lines), return `{ modification: null, warning: "..." }`

**Deletion:**
- `oldContent = removedLines.join("\n") + "\n"`
- If `countOccurrences(preImage, oldContent) === 1` → `{ where: oldContent, content: "" }`
- If not unique, expand with surrounding context lines (add lines from `contextBefore` and `contextAfter` to both `where` and `content` — the context lines stay, only the removed lines become empty).
- If still not unique after max expansion, try whole-hunk replacement.
- If still not unique, return warning.

**Replacement:**
- `oldContent = removedLines.join("\n") + "\n"`
- `newContent = addedLines.join("\n") + "\n"`
- If `countOccurrences(preImage, oldContent) === 1` → `{ where: oldContent, content: newContent }`
- If not unique, expand with context (same pattern as deletion but `content` includes the new lines surrounded by context).
- Escalate to whole-hunk, then warning.

### 3.5 — Context expansion helper

```ts
function expandWithContext({
  oldBlock,
  newBlock,
  contextBefore,
  contextAfter,
  preImage,
  maxContextLines,
}: {
  oldBlock: string;
  newBlock: string;
  contextBefore: string[];
  contextAfter: string[];
  preImage: string;
  maxContextLines: number;
}): { where: string; content: string } | null
```

Iteratively add context lines from `contextBefore` (prepend) and `contextAfter` (append) to both `where` and `content` until the `where` string is unique in `preImage` or the limit is reached. Alternate between adding a line from before and after.

For insertions (where `oldBlock` is empty), the `where` is the context envelope and `content` is the context with the inserted lines in between.

Return `null` if uniqueness is never achieved within the limit.

### 3.6 — Whole-hunk replacement helper

```ts
function wholeHunkReplacement({
  hunk,
  preImage,
}: {
  hunk: DiffHunk;
  preImage: string;
}): { modification: Modification; isValid: boolean }
```

Construct the pre-image portion of the hunk (all context + removed lines in order) and the post-image portion (all context + added lines in order). Use the pre-image portion as `where` and the post-image portion as `content`. Check uniqueness of `where` in `preImage`. Return `isValid: false` if not unique.

### 3.7 — Round-trip validation

```ts
function validateModifications({
  preImage,
  postImage,
  modifications,
}: {
  preImage: string;
  postImage: string;
  modifications: Modification[];
}): boolean
```

Apply all modifications sequentially to `preImage` using a local copy of the `applySingleModification` logic. Compare the result to `postImage` (after normalizing line endings — split both by `\n`, compare line-by-line, rejoin). Return `true` if they match.

**Important:** Do NOT import `applySingleModification` from `modify-engine.ts` directly — that function requires an `errors` parameter and throws on anchor issues. Instead, implement a local `applyModificationSafe` that returns `null` on failure instead of throwing. This keeps the algorithm self-contained and non-throwing.

```ts
function applyModificationSafe({
  content,
  mod,
}: {
  content: string;
  mod: Modification;
}): string | null
```

Same logic as `applySingleModification` but returns `null` on:
- Anchor not found
- Anchor ambiguous (count > 1)
Returns the modified string on success.

### 3.8 — Main export

```ts
function generateModifications({
  preImage,
  postImage,
  hunks,
}: {
  preImage: string;
  postImage: string;
  hunks: DiffHunk[];
}): GenerateModificationsResult
```

Logic:
1. If `hunks` is empty → return `{ modifications: [], warnings: ["Empty diff — no changes detected"] }`
2. If `preImage === postImage` → return `{ modifications: [], warnings: [] }`
3. Check for binary diff: if `preImage` or `postImage` contains null bytes, return `{ modifications: [], warnings: ["Binary file — cannot generate modifications"] }`
4. Parse hunks into atomic edits via `parseHunksIntoEdits`
5. For each edit, call `generateModificationForEdit`. Collect successful modifications and warnings.
6. Run `validateModifications` with the collected modifications.
7. If validation fails:
   - For each edit that succeeded, try escalating (expand context, then whole-hunk replacement).
   - Re-validate after each escalation attempt.
   - If an edit cannot be resolved, mark it for manual review (add warning, exclude that modification).
8. Return the final `{ modifications, warnings }`.

### 3.9 — Spec file (`diff-to-modifications.spec.ts`)

Use `@rcompat/test`. All tests use in-memory strings — no git, no filesystem.

Helper to build `DiffHunk` from a simple line array for readability:
```ts
function hunk(lines: [string, string][]): DiffHunk
// Each tuple: [prefix, content] where prefix is " ", "+", or "-"
```

Test cases:
1. **Insertion at file start** — preImage `"line2\nline3\n"`, insert `"line1\n"` at top → `{ where: "top", content: "line1\n" }`
2. **Insertion at file end** — preImage `"line1\nline2\n"`, append `"line3\n"` → `{ where: "bottom", content: "line3\n" }`
3. **Insertion after unique context** — preImage has unique line → `{ where: { after: "...\n" }, content: "..." }`
4. **Insertion before unique context** — same but before
5. **Deletion of unique line** — `{ where: "<line>\n", content: "" }`
6. **Replacement of unique line** — `{ where: "<old>\n", content: "<new>\n" }`
7. **Multi-line contiguous insertion** — 3 inserted lines → single entry
8. **Multi-line contiguous replacement** — 2 old → 2 new → single entry
9. **Ambiguous anchor: duplicated context line** — preImage has `"dup\n"` twice → context expansion produces unique anchor (expand to include adjacent unique line)
10. **Ambiguous after max expansion** — all surrounding lines are identical → whole-hunk exact replacement
11. **Still ambiguous** — whole hunk itself is duplicated → warning returned, edit skipped
12. **Round-trip: insertions** — apply generated modifications to preImage, equals postImage
13. **Round-trip: deletions** — same
14. **Round-trip: mixed** — same
15. **Round-trip failure triggers escalation** — deliberately construct a case where the initial anchor is ambiguous, verify escalation produces a working result
16. **Binary diff** — preImage contains null bytes → warning, empty modifications
17. **Empty diff** — no hunks → warning, empty modifications
18. **Multiple edits in one hunk** — two separate insertions in one hunk → two modification entries
19. **Multiple hunks** — edits in different hunks → separate entries, all round-trip correctly

---

## Phase 4: Orchestrator (`utils/create-powerup.ts`)

**Files to create:**
- `packages/cli/src/private/utils/create-powerup.ts`
- `packages/cli/src/private/utils/create-powerup.spec.ts`

### 4.1 — Types

```ts
type CreatePowerupOverrides = {
  pack?: string;
  type?: string;          // "multi-use" | "single-use", defaults to "single-use"
  description?: string;
  intent?: string;        // comma-separated
  variables?: string;     // comma-separated
  optionalVariables?: string;  // comma-separated
  packageDeps?: string;   // JSON string
};

type CreatePowerupResult = {
  packageName: string;
  packageAutoCreated: boolean;
  newFileCount: number;
  modifiedFileCount: number;
  deletedFileCount: number;
  warnings: string[];
};
```

### 4.2 — Diff parsing helper

```ts
function parseDiffHunks(diffOutput: string): DiffHunk[]
```

Parses raw `git diff` output text into `DiffHunk[]`. Logic:
1. Split output into lines.
2. Find hunk headers: lines matching `@@ -oldStart,oldCount +newStart,newCount @@`.
3. Parse the header to extract old/new start and count.
4. Collect subsequent lines until the next hunk header or end of diff:
   - Line starting with ` ` (space) → context line
   - Line starting with `+` → added line
   - Line starting with `-` → removed line
   - Lines starting with `\` (e.g., `\ No newline at end of file`) → skip (handle by checking if last line lacks trailing newline)
   - Lines like `diff --git`, `---`, `+++` → skip (header lines, not hunk content)
5. Return `DiffHunk[]`.

### 4.3 — Step name generation

```ts
function generateStepName({
  prefix,
  path,
  existingNames,
}: {
  prefix: "create" | "modify" | "delete";
  path: string;
  existingNames: Set<string>;
}): string
```

Logic:
- Strip extension from the path's basename (e.g., `index.ts` → `index`).
- Replace all `/` in the full path with `-`.
- Result: `${prefix}-${path-with-dashes}` (e.g., `create-packages-cli-src-commands-foo`).
- If the name exists in `existingNames`, append `-2`, `-3`, etc. until unique.
- Add the final name to `existingNames` and return it.

### 4.4 — Package auto-creation helper

```ts
async function ensurePackageExists({
  packageName,
  internalFolder,
}: {
  packageName: string;
  internalFolder: FileRef;
}): Promise<boolean>
```

Logic:
- Check if `internalFolder/<packageName>` exists. If yes, return `false` (not auto-created).
- If no, create the package directory structure:
  - Create `internalFolder/<packageName>/multi-use/`
  - Create `internalFolder/<packageName>/single-use/`
  - Write `package.json` with the same structure as `pack create`:
    ```json
    {
      "name": packageName,
      "version": "1.0.0",
      "description": "",
      "keywords": ["powerups-package"],
      "powerups": { "active": { "multi-use": {}, "single-use": {} } }
    }
    ```
- Return `true` (auto-created).

Reuse the constants `MULTI_USE_FOLDER`, `SINGLE_USE_FOLDER`, `PACKAGE_FILE`, `KEYWORD_PACKAGE`, `CLI_NAME` from `#constants`.

### 4.5 — Main export

```ts
async function createPowerup({
  name,
  workingDir,
  projectRoot,
  ...overrides
}: {
  name: string;
  workingDir?: string;  // undefined = blank mode
  projectRoot: FileRef;
} & CreatePowerupOverrides): Promise<CreatePowerupResult>
```

Logic:

**Step 1 — Resolve defaults:**
- `packageName`: from `overrides.pack` if provided, otherwise from `runtime.packageJSON().name`. Strip scope if scoped (e.g., `@liolocs/powerups-cli` → `powerups-cli`). If `packageJSON()` fails or has no `name`, throw `create_errors.package_not_initialized()`.
- `powerupsType`: `overrides.type ?? "single-use"`. Validate it's `"multi-use"` or `"single-use"`, else throw `create_errors.missing_type()`.
- `description`: `overrides.description ?? ""`
- `intent`: parse `overrides.intent` (comma-separated, trim, filter empty) → `string[]`
- `required`: parse `overrides.variables` → `string[]`
- `optional`: parse `overrides.optionalVariables` → `string[]` (may be empty)
- `packageDependencies`: parse `overrides.packageDeps` JSON if provided, validate with `packageDependencyGroupArraySchema`

**Step 2 — Validate project structure:**
- Check `projectRoot/<MAIN_FOLDER>` exists → else throw `main_folder_not_found`
- Resolve `internalFolder = mainFolder/<INTERNAL_FOLDER>`

**Step 3 — Ensure package exists:**
- Call `ensurePackageExists({ packageName, internalFolder })`
- Store `packageAutoCreated` result

**Step 4 — Create powerup folder:**
- `typeFolderName = powerupsFolderMap[powerupsType]`
- `packageDir = internalFolder/<packageName>`
- `typeFolder = packageDir/<typeFolderName>`
- Create `typeFolder` if it doesn't exist
- `outputFolder = typeFolder/<name>`
- If `outputFolder` exists → throw `already_exists(name)`
- Create `outputFolder`

**Step 5 — Branch: blank mode vs git mode:**

If `workingDir` is undefined (blank mode):
- Write `instructions.json` with:
  ```json
  {
    "name": name,
    "description": description,
    "variables": { "required": required, ...(optional.length > 0 ? { optional } : {}) },
    "intent": intent,
    "packageDependencies": packageDependencies,
    "steps": []
  }
  ```
- Register powerup in package.json (same logic as current create command)
- Add package to config
- Return result with zero counts

If `workingDir` is defined (git mode):
- Resolve working directory: if `workingDir` is a string, use `fs.ref(workingDir)`; if it was passed bare (flag present but value undefined), use `runtime.cwd()`.
  - **Important:** The command layer passes this distinction. See Phase 5 for how `--working-dir` bare vs with-value vs absent is detected using `rawFlags`.
- Call `getGitStatus({ workingDir, projectRoot })` → `GitChange[]`
- If empty → write blank instructions (same as blank mode), return with a warning `"No git changes detected in <workingDir>"`
- Initialize `steps: Step[]`, `warnings: string[]`, `existingNames: Set<string>`
- Group changes by status: `newFiles`, `modifiedFiles`, `deletedFiles`, `renamedFiles`

**Step 6 — Process new files (create steps):**
For each new file (sorted alphabetically by path):
- `sourcePath = workingDir/<path>` (or `projectRoot/<path>` — the file exists in the working tree)
- `templatePath = outputFolder/src/<path>` (mirror the project-relative path under `src/`)
- Create the template directory structure, copy file content verbatim
- Generate step name via `generateStepName({ prefix: "create", path, existingNames })`
- Push step: `{ type: "create", name: stepName, template: "src/<path>", outputPath: path }`

**Step 7 — Process modified files (modify steps):**
For each modified file (sorted alphabetically):
- Run `git diff HEAD -- "<path>"` with `cwd: projectRoot.path` → diff output string
- If diff output contains "Binary files differ" → add warning, skip
- If diff output is empty → add warning, skip
- Get pre-image: run `git show HEAD:"<path>"` → string
- Get post-image: read `projectRoot/<path>` → string
- Parse diff into `DiffHunk[]` via `parseDiffHunks`
- Call `generateModifications({ preImage, postImage, hunks })` → `{ modifications, warnings: modWarnings }`
- Add `modWarnings` to the warnings array (prefix each with the file path)
- Write `modifications` as JSON to `outputFolder/src/<path>.modify.json`
- Generate step name via `generateStepName({ prefix: "modify", path, existingNames })`
- Push step: `{ type: "modify", name: stepName, template: "src/<path>.modify.json", outputPath: path }`

**Step 8 — Process deleted files (delete steps):**
For each deleted file (sorted alphabetically):
- Generate step name via `generateStepName({ prefix: "delete", path, existingNames })`
- Push step: `{ type: "delete", name: stepName, outputPath: path }`

**Step 9 — Process renamed files:**
For each renamed file:
- Add warning: `"Renamed file: <old> → <new> (requires manual review, not included)"`

**Step 10 — Assemble instructions.json:**
- Steps ordered: all create steps (alphabetical), then modify steps (alphabetical), then delete steps (alphabetical)
- Write the same JSON structure as blank mode but with the populated `steps` array
- Validate the final instructions against `instructionsSchema` from `#schemas/instruction`

**Step 11 — Register powerup:**
- Read package's `package.json`, add the powerup to the appropriate type folder map (same logic as current create command)
- Write the updated `package.json`
- Call `addPackageToConfig(root, packageName)`

**Step 12 — Return result:**
```ts
{
  packageName,
  packageAutoCreated,
  newFileCount: newFiles.length,
  modifiedFileCount: modifiedFiles.length,
  deletedFileCount: deletedFiles.length,
  warnings,
}
```

### 4.6 — Spec file (`create-powerup.spec.ts`)

Use `@rcompat/test`, `@rcompat/fs`, `@rcompat/io`. Set up temp directories with real git repos (pattern from `use.spec.ts`).

Helper functions:
```ts
async function setupTestEnv(): Promise<{ testRoot: FileRef; ... }>
// Creates tmp dir, .powerups/, internal/, git init, initial commit

async function createFile(root: FileRef, path: string, content: string): Promise<void>
async function modifyFile(root: FileRef, path: string, content: string): Promise<void>
async function deleteFile(root: FileRef, path: string): Promise<void>
async function gitCommit(root: FileRef, message: string): Promise<void>
```

Test cases:
1. **Blank mode** — `workingDir` undefined → `instructions.json` has `steps: []`, no template files
2. **New file** — create file, don't commit, run createPowerup → `create` step, template copied verbatim to `src/<path>`, `outputPath` matches
3. **Modified file** — commit a file, modify it, run createPowerup → `modify` step, `.modify.json` template exists with correct modifications, round-trip (apply modifications to original → equals modified content)
4. **Deleted file** — commit a file, delete it, run createPowerup → `delete` step, no template
5. **Mixed** — new + modified + deleted → all three step types, ordered create → modify → delete
6. **Renamed file** — `git mv` a file, run createPowerup → warning printed, no step for the renamed file
7. **Package auto-creation** — don't create the package beforehand, run createPowerup with default package name → package folder created with correct structure
8. **Scoped package name** — set `package.json` name to `@scope/my-pkg` → package folder is `my-pkg` (unscoped)
9. **Step name uniqueness** — two files with same basename in different dirs → no name collision (verify unique step names)
10. **instructions.json validates** — run `instructionsSchema.parse` on the output → no throw
11. **Powerup registered in package.json** — verify the package's `package.json` has the powerup in the type folder map
12. **No git changes** — clean working tree, run createPowerup with `workingDir` → blank `instructions.json`, warning about no changes
13. **Lockfile exclusion** — modify `pnpm-lock.yaml`, run createPowerup → no step for lockfile
14. **`.powerups/` exclusion** — create a file under `.powerups/`, run createPowerup → no step for it
15. **Summary result** — verify `CreatePowerupResult` counts match the actual changes

---

## Phase 5: Rewrite the `create` Command (`commands/create/index.ts`)

**File:** `packages/cli/src/private/commands/create/index.ts`

### 5.1 — Flag definitions

Remove `required: true` from all flags. Remove the `name` flag (replaced by positional arg). Add `workingDir` flag. Keep all other flags as optional:

```ts
flags: [
  { name: "workingDir", long: "working-dir", short: "wd", description: "Generate from git changes in this directory (or cwd if no path)" },
  { name: "pack", long: "pack", short: "pk", description: "Package name (defaults to package.json name)" },
  { name: "type", long: "type", short: "t", description: "Powerup type: multi-use or single-use (defaults to single-use)" },
  { name: "description", long: "description", short: "d", description: "Human-readable description" },
  { name: "intent", long: "intent", short: "i", description: "Comma-separated intent keywords" },
  { name: "variables", long: "variables", short: "v", description: "Comma-separated required variable names" },
  { name: "optionalVariables", long: "optional-variables", short: "ov", description: "Comma-separated optional variable names" },
  { name: "packageDeps", long: "package-deps", short: "p", description: "JSON package dependencies specification" },
],
```

### 5.2 — Action

```ts
action: async ({ subcommands, flags, rawFlags, context }) => {
  const root: FileRef = context?.root ?? await runtime.projectRoot();

  // Positional name from subcommands
  const name = subcommands?.[0];
  if (!is.defined(name) || name.length === 0) {
    throw create_errors.missing_name();  // see note below
  }

  // Detect --working-dir presence using rawFlags
  // flags.workingDir is undefined both when absent and when passed bare
  const workingDirRaw = rawFlags?.find(
    f => f.flag === "--working-dir" || f.flag === "--wd" || f.flag === "-wd"
  );
  const hasWorkingDir = is.defined(workingDirRaw);
  const workingDir = hasWorkingDir
    ? (is.defined(workingDirRaw!.value) && workingDirRaw!.value.length > 0
        ? workingDirRaw!.value
        : undefined)  // undefined = use runtime.cwd() in createPowerup
    : undefined;     // undefined = blank mode in createPowerup

  // The distinction: 
  //   hasWorkingDir=false → blank mode (pass undefined to createPowerup)
  //   hasWorkingDir=true, value undefined → git mode with runtime.cwd() (pass "" to signal "use cwd")
  //   hasWorkingDir=true, value set → git mode with that path

  const result = await createPowerup({
    name,
    workingDir: hasWorkingDir
      ? (workingDir ?? "")  // "" signals "use runtime.cwd()"
      : undefined,          // undefined signals "blank mode"
    projectRoot: root,
    pack: flags.pack,
    type: flags.type,
    description: flags.description,
    intent: flags.intent,
    variables: flags.variables,
    optionalVariables: flags.optionalVariables,
    packageDeps: flags.packageDeps,
  });

  // Print summary
  cli.print(`Created ${SINGULAR_NAME}: ${name} (...) in package: ${result.packageName}${result.packageAutoCreated ? " (auto-created)" : ""}\n`);
  // Print counts and warnings...
}
```

**Note on `missing_name` error:** Add a `missing_name` error to `createErrors.ts`:
```ts
missing_name: () => {
  const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} name is required.\n\nUsage: ${CLI_CMD} create <name> [options]`;
  return t`${errorBGText}${errorText}`;
},
```

**Working-dir value handling in `createPowerup`:** Update the `workingDir` parameter handling in `create-powerup.ts`:
- `undefined` → blank mode (no git)
- `""` → git mode, use `runtime.cwd()`
- any other string → git mode, use `fs.ref(workingDir)`

### 5.3 — Update `bin.ts` examples

In `packages/cli/src/bin.ts`, update the create example:
```ts
`$ ${CLI_CMD} create my-powerup`,
`$ ${CLI_CMD} create my-powerup --working-dir`,
```

### 5.4 — Update README.md command table

In `packages/cli/README.md`, update the `create` row description if needed (the current description is "Create a new powerup in a package" — this is still accurate).

---

## Phase 6: Update Existing Spec (`commands/create/create.spec.ts`)

**File:** `packages/cli/src/private/commands/create/create.spec.ts`

### 6.1 — Rewrite the test file

The existing tests use the old flag-based interface (`--pack`, `--type`, `--name`, `--description` as flags with `subcommands: []`). The new interface uses a positional name (passed as `subcommands: ["<name>"]`).

Updated test structure:

**Setup helpers** (reuse existing `reset`, `createTestPackage` — keep them as-is, they create the package structure).

**Blank mode tests:**
1. `pup create my-powerup` (no flags) → `instructions.json` exists with `steps: []`
2. `pup create my-powerup --pack=test-pkg --type=multi-use --description="test"` → overrides applied: description in JSON, type folder is multi-use
3. `pup create my-powerup --intent="component,ui" --variables="ComponentName"` → intent and variables in JSON
4. `pup create my-powerup --optional-variables="sub,subDescription"` → optional variables in JSON
5. `pup create my-powerup` without `--optional-variables` → optional omitted from JSON
6. `pup create my-powerup -p='[{"dependencies":["react@^18.0.0"]}]'` → packageDependencies in JSON
7. `pup create my-powerup` without `-p` → packageDependencies undefined in JSON

**Error cases:**
8. `.powerups/` folder missing → `main_folder_not_found`
9. Powerup name already exists → `already_exists`
10. No name provided (`subcommands: []`) → `missing_name`
11. Invalid `--type` value → `missing_type`
12. Invalid `--package-deps` JSON → `invalid_package_deps_json`

**Registration tests:**
13. Powerup registered in package's `package.json` (type folder map updated)
14. Package added to project `config.json`

**Note:** The existing tests that pass `subcommands: []` with `{ flag: "--name", value: "..." }` need to be rewritten to pass `subcommands: ["<name>"]` instead. The `--name` flag no longer exists.

---

## Phase 7: Cleanup and Integration

### 7.1 — Remove unused error codes

After the rewrite, check if `missing_pack` and `pack_not_found` are still used:
- `missing_pack`: no longer needed (pack defaults from package.json). Remove from `createErrors.ts`.
- `pack_not_found`: no longer needed (auto-creation handles this). Remove from `createErrors.ts`.
- `missing_type`: keep — still used for invalid `--type` values.
- `invalid_output_json`: check if still referenced — if not, remove.
- `missing_name`: add new error code (Phase 5.2).

### 7.2 — Update `AGENTS.md` quick reference

In the root `AGENTS.md`, update the create command reference:
```
| Create a multi-use powerup | `pup create <name> --type=multi-use -d="..." -i="..." -v="..." -ov="..." -p='...'` |
| Create a single-use powerup | `pup create <name> -d="..." -i="..." -v="..." -ov="..." -p='...'` |
| Create from git changes    | `pup create <name> --working-dir[=<path>]` |
```

### 7.3 — Update `powerups-capture.njk` skill

The capture skill currently instructs the AI to run `pup create --pack=... --type=... -n=... -d=...`. Update step 6 to use the new interface:
```
`{{ CLI_CMD }} create <name> --pack=<package> --type=multi-use -d="<description>" -i="<intent>" -v="<required-vars>" -ov="<optional-vars>" -p='<package-deps-json>'`
```

Or for git-based capture:
```
`{{ CLI_CMD }} create <name> --working-dir`
```

### 7.4 — Run full test suite

```sh
pnpm test    # in packages/cli
pnpm lint    # in root
pnpm knip    # check for dead code
```

### 7.5 — Build verification

```sh
pnpm build:packages  # from root — verify the build succeeds
```

---

## Implementation Order Summary

| Step | Module | Depends on | Tests |
|------|--------|-----------|-------|
| 1 | `errors/createErrors.ts` (add `not_a_git_repo`, `package_not_initialized`, `missing_name`; remove `missing_pack`, `pack_not_found`, `invalid_output_json` if unused) | — | covered by downstream specs |
| 2 | `utils/git/git-status.ts` | createErrors, @rcompat/io, @rcompat/fs | `git-status.spec.ts` |
| 3 | `utils/git/diff-to-modifications.ts` | #schemas/modification | `diff-to-modifications.spec.ts` |
| 4 | `utils/create-powerup.ts` | git-status, diff-to-modifications, createErrors, #schemas/instruction, #schemas/package, #utils/config, #constants | `create-powerup.spec.ts` |
| 5 | `commands/create/index.ts` (rewrite) | create-powerup, createErrors | — (covered by create.spec.ts) |
| 6 | `commands/create/create.spec.ts` (rewrite) | rewritten create command | — |
| 7 | `bin.ts` examples + `AGENTS.md` + `powerups-capture.njk` | — | — |

---

## Key Design Decisions Reflected in the Plan

1. **`applyModificationSafe` instead of importing `applySingleModification`**: The existing `applySingleModification` takes an `errors` parameter and throws on anchor issues. The diff-to-modifications algorithm needs non-throwing behavior for round-trip validation. A local safe variant returns `null` on failure.

2. **`rawFlags` for `--working-dir` detection**: The `@liolocs/program` flag matching sets `flags.workingDir` to `undefined` both when the flag is absent and when it's passed bare (no `=value`). The `rawFlags` array preserves the distinction — the command checks `rawFlags` for the flag's presence.

3. **`workingDir` parameter convention in `createPowerup`**: `undefined` = blank mode, `""` = git mode with `runtime.cwd()`, any other string = git mode with that path. This avoids ambiguity between "flag absent" and "flag present but no path".

4. **Diff parsing in the orchestrator**: `parseDiffHunks` lives in `create-powerup.ts` (the orchestrator), not in `diff-to-modifications.ts` (the pure algorithm). This keeps the algorithm testable without git and places the I/O boundary at the orchestrator.

5. **Step ordering**: create → modify → delete, alphabetical within each group. Deterministic output for reproducible builds.