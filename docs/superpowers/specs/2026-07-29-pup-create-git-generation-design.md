# `pup create` — Git-Based Powerup Generation

## Problem

Creating a powerup from scratch currently requires AI involvement for every step —
the user (or AI) must run `pup create` with many required flags, then manually copy
files, write template files, author modification entries, and assemble the `steps`
array. The `powerups-capture` skill exists to guide this, but the mechanical work
(detecting changed files, copying them, generating modification entries from diffs)
is repetitive and should be automated by the CLI itself.

## Solution

Rewrite `pup create` to accept a positional powerup name and an optional
`--working-dir` flag. When `--working-dir` is provided, the CLI uses git to detect
changes in the working directory, auto-generates template files and modification
entries, and writes a complete `instructions.json` with populated steps. When
`--working-dir` is absent, it creates a blank `instructions.json` with `steps: []`.

## Command Interface

```
pup create <name> [options]
```

**Positional argument:**

- `<name>` — the powerup name (kebab-case). Replaces the old `--name` flag.

**Optional flags (all overrides, all blank/defaulted if omitted):**

| Flag | Short | Default | Purpose |
|------|-------|---------|---------|
| `--working-dir` | `--wd` | (absent) | Triggers git-based generation. Accepts an optional path; bare flag uses `runtime.cwd()`. Absent = blank `instructions.json` |
| `--pack` | `--pk` | `runtime.packageJSON().name` (unscoped) | Package to create the powerup in |
| `--type` | `--t` | `single-use` | Powerup type (multi-use or single-use) |
| `--description` | `--d` | `""` | Human-readable description |
| `--intent` | `--i` | `[]` | Comma-separated intent keywords |
| `--variables` | `--v` | `[]` | Comma-separated required variable names |
| `--optional-variables` | `--ov` | `[]` | Comma-separated optional variable names |
| `--package-deps` | `--p` | (omitted) | JSON package dependencies spec |

**Two modes:**

1. **Blank mode** (`--working-dir` absent): Creates the powerup folder with a blank
   `instructions.json` — `steps: []`, no templates. The user (or AI) fills in steps
   and templates manually afterward.

2. **Git generation mode** (`--working-dir` present): Runs git against the working
   directory, categorizes changes (new/modified/deleted), copies new files as
   verbatim templates, generates modification templates from diffs for modified
   files, and writes a complete `instructions.json` with populated `steps`.

**Flow:**

1. Resolve project root via `runtime.projectRoot()`
2. Resolve package name (from flag or `runtime.packageJSON().name`, unscoped)
3. Validate/ensure the package exists (auto-create if needed)
4. Create the powerup folder at `.powerups/internal/<package>/<type-folder>/<name>/`
5. If `--working-dir` absent → write blank `instructions.json`, register, done
6. If `--working-dir` present → run git-based generation, write populated
   `instructions.json` + template files
7. Register the powerup in the package's `package.json`
8. Add package to project `config.json` if not already listed

**No variable parameterization:** Copied templates are verbatim — concrete values,
no `{{var}}` placeholders. Variables default to empty. Users (or AI) parameterize
templates afterward if needed.

## Module Structure

Three new modules under `packages/cli/src/private/utils/`:

```
private/utils/
  git/
    git-status.ts                # parse git status --porcelain, categorize files
    git-status.spec.ts
    diff-to-modifications.ts     # core algorithm: hunks → modification entries
    diff-to-modifications.spec.ts
  create-powerup.ts             # orchestrator: calls git modules, copies templates, writes instructions.json
  create-powerup.spec.ts
```

### `git/git-status.ts`

Exports `getGitStatus({ workingDir, projectRoot })` → `GitChange[]`

- Runs `git status --porcelain -- <workingDir>` from the project root
- Parses each line into a `GitChange`:
  ```ts
  type GitChange = {
    path: string;      // relative to project root (for outputPath)
    status: "new" | "modified" | "deleted" | "renamed" | "unknown";
    rawStatus: string; // the XY codes from porcelain output
  };
  ```
- Handles the porcelain format: `??` (untracked→new), `M`/`MM`/`AM` (modified),
  `D` (deleted), `R` (renamed), etc.
- Converts git-relative paths to project-root-relative paths
- Excludes `.powerups/` directory entries (don't capture changes to the powerups
  system itself)
- Excludes lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`,
  `bun.lockb`)

### `git/diff-to-modifications.ts`

Exports `generateModifications({ preImage, postImage, hunks })` →
`{ modifications: Modification[], warnings: string[] }`

The algorithm is pure — it accepts the pre-image string, post-image string, and
parsed diff hunks as inputs. The git command invocation (running `git diff`,
`git show`) and the raw diff output parsing (converting `git diff` text into
structured `DiffHunk` objects) both happen in the orchestrator
(`create-powerup.ts`), not in this module. This keeps the algorithm testable
without git.

```ts
type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

type DiffLine = {
  type: "context" | "added" | "removed";
  content: string;
};
```

### `create-powerup.ts`

Exports `createPowerup({ name, workingDir, projectRoot, ...overrides })` →
`CreatePowerupResult`

Orchestrates the full flow:
1. Calls `getGitStatus` to categorize files
2. For new files: copies the file verbatim to `<powerup>/src/<path>`
3. For modified files: fetches diff + pre-image + post-image via git, calls
   `generateModifications`, writes the modification JSON to
   `<powerup>/src/<path>.modify.json`
4. For deleted files: records a `delete` step (no template)
5. Assembles the `steps` array
6. Writes `instructions.json`
7. Returns a summary (files created, modified, deleted, warnings)

The `create` command (`create/index.ts`) becomes thin: parses flags, resolves
defaults, calls `createPowerup` (or writes blank instructions if no `--working-dir`),
prints the summary.

## Git Status Parsing

**Command:** `git status --porcelain -- <workingDir>` (run from project root)

Classification by porcelain codes:

| Porcelain codes | Classification | Step type |
|----------------|---------------|-----------|
| `??` | untracked | `create` |
| `A `, `AM`, ` M`, `M `, `MM` | modified | `modify` |
| `D `, ` D`, `AD`, `MD` | deleted | `delete` |
| `R `, `RM`, `C ` | renamed/copied | manual review warning |
| anything else | unknown | manual review warning |

**Path resolution:**
- `git status --porcelain` reports paths relative to the git root
- Resolve the absolute path from the git root, then make it relative to the
  project root for `outputPath`
- If a file is outside the project root, skip it with a warning

**Edge cases:**
- No changes found → write blank `instructions.json` with `steps: []`, print
  "No git changes detected in `<workingDir>`."
- Not a git repo → throw `not_a_git_repo` error
- Renames → skip, collect warnings listing each rename

## Diff-to-Modifications Algorithm

Converts a git diff for a single file into an array of `Modification` entries that,
when applied to the pre-image, reproduce the post-image exactly.

**Inputs:**
- Pre-image: the file content at HEAD (fetched via `git show HEAD:<file>`)
- Post-image: the file content from the working directory
- Diff: parsed hunks from `git diff HEAD -- <file>`

### Step 1 — Parse hunks into atomic edits

For each hunk, group contiguous lines into atomic edits:
- A block of only `+` lines → **insertion**
- A block of only `-` lines → **deletion**
- A block with both `-` and `+` lines → **replacement**
- ` ` (space) lines are **context** — never part of an edit, but serve as anchor
  candidates

Don't emit one entry per line — keep contiguous changes together as a single edit.

### Step 2 — Generate modification entries per edit type

| Edit shape | Modification entry |
|-----------|-------------------|
| Insertion at file start | `{ where: "top", content: "..." }` |
| Insertion at file end | `{ where: "bottom", content: "..." }` |
| Insertion after unique context line A | `{ where: { after: "A" }, content: "..." }` |
| Insertion before unique context line B | `{ where: { before: "B" }, content: "..." }` |
| Deletion | `{ where: "<old>", content: "" }` (exact replacement) |
| Replacement (-old / +new) | `{ where: "<old>", content: "<new>" }` (exact replacement) |

**Key rule:** Use `{ after }` / `{ before }` only for **pure insertions** with a
verified-unique anchor. Use exact string replacement for every deletion and
replacement. The existing engine's exact matcher requires uniqueness and throws
on ambiguity — that's the safety we want. The `{ after }` / `{ before }` matcher
uses `indexOf` and silently picks the first match — that's the risk we avoid.

### Step 3 — Anchor uniqueness verification

For every candidate anchor, check its occurrence count in the pre-image:
- Count = 1 → safe, use it
- Count > 1 → not safe, escalate (Step 4)
- Count = 0 → escalate

### Step 4 — Context expansion (escalation order)

When an anchor is ambiguous:

1. **Expand the anchor** — include one additional unchanged context line above
   and/or below until the anchor string is unique. For insertions, expand into an
   exact-replacement "context envelope":
   ```json
   {
     "where": "stable-before\nold-anchor\nstable-after\n",
     "content": "stable-before\nold-anchor\ninserted\nstable-after\n"
   }
   ```
   For deletions/replacements, expand the `where` string with surrounding context
   lines.

2. **Whole-hunk exact replacement** — if expansion still doesn't reach uniqueness,
   replace the entire hunk's pre-image content with the entire hunk's post-image
   content as one exact replacement.

3. **Mark for manual review** — if even whole-hunk replacement has ambiguous anchors
   (repeated identical blocks), collect a warning and skip that edit. The file's
   `modify` step still gets created with whatever modifications succeeded; the
   warning tells the user what to fix.

Rules for expansion:
- Expand on line boundaries, never mid-line
- Don't cross into another changed region — merge those into one larger replacement
  instead
- Alternate above/below or pick whichever side has more meaningful context
- If expansion reaches a limit (10 context lines), escalate to whole-hunk
  replacement

### Step 5 — Round-trip validation

After generating all modifications for a file:

```ts
const generated = applyModifications(preImage, modifications);

if (generated !== postImage) {
  // Regenerate with more context or fall back to whole-hunk replacement
  // If still fails, mark for manual review
}
```

This uses the existing `applySingleModification` logic from `modify-engine.ts` to
apply the generated entries sequentially, then compares byte-for-byte (with
normalized line endings). If the result doesn't match, re-attempt generation with
expanded context or whole-hunk replacement. If it still fails, mark the file for
manual review and include whatever modifications did validate.

### Step 6 — Serialization

Modification templates are written as `.json` files (no variable substitution needed
since we don't parameterize). Use `JSON.stringify(modifications, null, 2)` for
readability.

### Edge cases

- **Binary files in diff:** `git diff` outputs "Binary files differ". Skip with a
  warning — can't generate modifications for binary content.
- **Empty diff for a file reported as modified:** Skip with a warning.
- **No changes after generation (all edits marked for review):** Still create the
  `modify` step with an empty modification array `[]` and a warning, so the user
  knows the file needs attention.

## Template Writing & Instructions Generation

### Template file layout

All templates live under `<powerup>/src/`, mirroring the project-relative path:

```
<powerup>/
  instructions.json
  src/
    packages/cli/src/commands/foo.ts          ← verbatim copy (new file)
    packages/cli/src/index.ts.modify.json     ← modification entries (modified file)
    packages/cli/src/errors.ts.modify.json    ← modification entries (modified file)
```

### New files (create steps)

- Copy the file verbatim from the working directory to
  `<powerup>/src/<project-relative-path>`
- Preserve the original extension
- Step entry:
  ```json
  {
    "type": "create",
    "name": "<step-name>",
    "template": "src/<path>",
    "outputPath": "<path>"
  }
  ```

### Modified files (modify steps)

- Write the modification entries array as JSON to
  `<powerup>/src/<path>.modify.json`
- Step entry:
  ```json
  {
    "type": "modify",
    "name": "<step-name>",
    "template": "src/<path>.modify.json",
    "outputPath": "<path>"
  }
  ```

### Deleted files (delete steps)

- No template file needed
- Step entry:
  ```json
  {
    "type": "delete",
    "name": "<step-name>",
    "outputPath": "<path>"
  }
  ```

### Step naming

Step names must be unique within the `steps` array. Generated names are derived
from the project-relative path:

- Create: `create-<path-with-dashes>` — e.g., `create-packages-cli-src-commands-foo`
- Modify: `modify-<path-with-dashes>` — e.g., `modify-packages-cli-src-index`
- Delete: `delete-<path-with-dashes>` — e.g., `delete-packages-cli-src-old`

Slashes in the path are replaced with dashes. If a collision occurs, append `-2`,
`-3`, etc.

### Instructions.json assembly

```json
{
  "name": "<name>",
  "description": "<description or empty string>",
  "variables": {
    "required": ["<variables from flag or empty>"],
    "optional": ["<optional-variables from flag, if provided>"]
  },
  "intent": ["<intent from flag or empty>"],
  "packageDependencies": "<from flag, if provided>",
  "steps": [
    "<all create steps>",
    "<all modify steps>",
    "<all delete steps>"
  ]
}
```

Steps are ordered: all `create` steps first, then `modify`, then `delete`. Within
each group, ordered alphabetically by path for deterministic output.

### Summary output

After generation, print a summary:

```
Created powerup: my-feature (single-use) in package: my-project

  3 new files → create steps
  2 modified files → modify steps
  1 deleted file → delete step

  Warnings:
    - Renamed file: src/old.ts → src/new.ts (requires manual review, not included)
    - packages/cli/src/index.ts: 1 edit needs manual review (ambiguous anchors)
```

## Error Handling

### New error codes (added to `createErrors.ts`)

| Code | When | Message |
|------|------|---------|
| `not_a_git_repo` | `git status` fails | "Working directory is not a git repository. Run `pup create <name>` without `--working-dir` to create a blank powerup." |
| `package_not_initialized` | `runtime.packageJSON()` fails or no `name` field | "Could not determine package name from package.json. Pass `--pack=<name>` explicitly." |

### Warnings (non-fatal, printed to stdout)

| Situation | Behavior |
|-----------|----------|
| No git changes found | Write blank `instructions.json`, print "No git changes detected in `<workingDir>`." |
| Renamed/copied files | Skip, print warning per file |
| Binary file in diff | Skip that file's modifications, print warning |
| Ambiguous anchors after escalation | Mark edit for manual review, print warning with file + edit details |
| Round-trip validation failure after all escalation | Mark file for manual review, include successfully-validated modifications, print warning |
| File outside project root | Skip, print warning |
| Empty diff for "modified" file | Skip, print warning |

### Fatal errors (throw, halt execution)

| Situation | Behavior |
|-----------|----------|
| `.powerups/` folder doesn't exist | Same as current: "Run `pup project init` first." |
| Powerup name already exists | Same as current: "Powerup `<name>` already exists." |
| Package doesn't exist and can't be auto-created | Throw with the failure reason |
| Git command execution failure (not a repo check) | Throw with the git error output |

### Package auto-creation

When `--pack` is not provided, default to `runtime.packageJSON().name`. If that
package folder doesn't exist under `.powerups/internal/`, auto-create it using the
same logic as `pup pack create <name>`. This is transparent to the user; the summary
mentions "in package: `<name>` (auto-created)".

If the `name` from `package.json` is scoped (e.g., `@liolocs/powerups-cli`), strip the
scope and use just the unscoped name (`powerups-cli`) as the package name, since
folder names can't contain `/`.

## Testing

### `git-status.spec.ts`

- Parse `??` (untracked) → `new`
- Parse ` M`, `M `, `MM`, `AM` → `modified`
- Parse ` D`, `D ` → `deleted`
- Parse `R ` → `renamed`
- Path conversion: git-root-relative → project-root-relative
- Exclusion of `.powerups/` entries
- Exclusion of lockfiles
- File outside project root → skipped
- Empty git status output → empty array
- Not a git repo → throws `not_a_git_repo`

### `diff-to-modifications.spec.ts`

Each test sets up a pre-image string, a post-image string, and asserts the
generated modifications round-trip correctly:

- Pure insertion at file start → `{ where: "top" }`
- Pure insertion at file end → `{ where: "bottom" }`
- Pure insertion after unique context line → `{ where: { after } }`
- Pure insertion before unique context line → `{ where: { before } }`
- Deletion of unique line → exact replacement with empty content
- Replacement of unique line → exact replacement
- Multi-line contiguous insertion → single entry
- Multi-line contiguous replacement → single entry
- Ambiguous anchor (duplicated context line) → context expansion produces unique
  anchor
- Ambiguous anchor after max expansion → whole-hunk exact replacement
- Still ambiguous → warning returned, edit skipped
- Round-trip: apply generated modifications to pre-image, equals post-image
- Round-trip failure triggers escalation (expanded context → whole-hunk → manual
  review)
- Binary diff → warning, no modifications
- Empty diff → warning, no modifications

Tests use in-memory strings (not real git commands) by structuring
`generateModifications` to accept the pre-image, post-image, and diff hunks as
inputs. The git command invocation happens in the orchestrator
(`create-powerup.ts`), not in the algorithm module.

### `create-powerup.spec.ts`

Integration-level tests using a temp directory with a real git repo:

- `--working-dir` absent → blank `instructions.json` with `steps: []`
- New file → `create` step + verbatim template copied to `src/<path>`
- Modified file → `modify` step + `.modify.json` template with correct modifications
- Deleted file → `delete` step, no template
- Mixed (new + modified + deleted) → all three step types in correct order
- Renamed file → warning printed, no step generated
- Package auto-creation from `package.json` name
- Scoped package name → unscoped folder name
- Step name uniqueness (collision handling)
- `instructions.json` validates against `instructionsSchema`
- Powerup registered in package's `package.json`

### Existing `create.spec.ts`

Updated to reflect the new positional-name interface and optional flags:

- `pup create <name>` (no flags) → blank instructions
- `pup create <name> --pack=... --type=... --description=...` → overrides applied
- Error cases preserved (main folder not found, already exists)