# Fix Create Command: Diff-to-Modifications Pipeline

## Problem

The `create --working-dir` command generates a powerup from git changes. It captures new files as `create` steps and modified files as `modify` steps with `.modify.json` templates. When run against `powerups-website`, two modified files (`client/master.css` and `tsconfig.json`) produced **empty `[]` modify.json files**, losing all their changes.

### What was captured correctly

- `components.json` (new) — full content
- `lib/components/ui/button/button.svelte` (new) — full content
- `lib/components/ui/button/index.ts` (new) — full content
- `lib/components/utils.ts` (new) — full content
- `config/session.ts` (modified) — import path change
- `package.json` (modified) — dependency additions
- `views/Home.svelte` (modified) — button import + usage

### What was lost

- `client/master.css` (modified) — empty `[]`, all CSS changes lost (import additions, oklch variable replacements in `:root` and `.dark`, `--font-sans` change, `--radius` change, `--radius-2xl/3xl/4xl` additions, `html { @apply font-sans; }` addition)
- `tsconfig.json` (modified) — empty `[]`, all tsconfig changes lost (`@lib`/`@lib/*` path alias additions, `#lib/*` path alias removal, trailing newline removal)

### Intentionally excluded (not bugs)

- `.powerups/config.json` — excluded by `shouldExclude()` in `git-status.ts`; the create command handles config registration via `addPackageToConfig`
- `pnpm-lock.yaml` — excluded by `EXCLUDED_PATHS` in `git-status.ts`; lock files should not be templated

## Root Causes

Four bugs in `packages/cli/src/private/utils/git/diff-to-modifications.ts` and `packages/cli/src/private/utils/create-powerup.ts`:

### Bug 1: `i` not advanced to `j` in `parseHunksIntoEdits` (context duplication)

In `parseHunksIntoEdits`, after processing an edit's removed/added lines, `i` points to the first context line. The `contextAfter` collection loop uses a separate variable `j` to scan past the context lines, but `i` is never set to `j`. The outer while-loop re-processes those same context lines, pushing them into `contextBuffer` a second time.

This means `contextBefore` for subsequent edits in the same hunk contains **duplicated context lines**. For the CSS file, the `--radius` edit got `contextBefore` with 6 lines (font-sans, font-serif, font-mono **repeated twice**), which doesn't exist in the actual file. This makes `countOccurrences(preImage, where)` return 0, making it impossible to find any anchor.

### Bug 2: `expandWithContext` narrows context instead of expanding

The function is called when a simple anchor isn't unique. But instead of trying the full context first and then expanding *beyond* the hunk's context lines to find a distinguishing line, it *narrows* the context by removing lines. This is backwards — narrowing makes anchors less unique, not more.

For the CSS `--radius` case, `--radius: 1.3rem;` appears in both `:root` and `.dark` blocks with identical surrounding hunk context (`--font-sans`, `--font-serif`, `--font-mono`, `--shadow-x`, etc.). No amount of narrowing within the hunk's context can distinguish them. The fix requires expanding beyond the hunk to reach a distinguishing line like `:root {` or a unique variable value.

### Bug 3: Trailing newline changes not handled

When a file's trailing newline is added or removed, the diff includes a hunk with a `\ No newline at end of file` marker. But `parseDiffHunks` strips this marker entirely, and `joinLines` always appends `\n`, so both old and new content become identical strings. The modification becomes a no-op, and validation fails because the trailing newline difference remains.

For `tsconfig.json`, the preImage ends with `}\n` and the postImage ends with `}`. This 1-character difference causes validation to fail and, combined with Bug 4, discards all modifications.

### Bug 4: Broken final fallback in `generateModifications`

When primary validation fails, the fallback tries to keep mods incrementally using `validateModifications`, which checks for exact match with the postImage. No partial set of modifications can produce the exact postImage, so `validMods` is always `[]`. This discards everything even when most mods are individually correct.

## Design

All fixes are in `packages/cli/src/private/utils/git/diff-to-modifications.ts`, with minor changes to `packages/cli/src/private/utils/create-powerup.ts` for parsing the `\ No newline at end of file` marker. The modification schema in `schemas/modification.ts` needs no changes.

### Fix 1: Advance `i` to `j` in `parseHunksIntoEdits`

One-line fix: after the `contextAfter` collection loop, set `i = j` to skip past the already-processed context lines.

**File**: `diff-to-modifications.ts` — `parseHunksIntoEdits`

```typescript
// After the contextAfter collection loop and edit push:
contextBuffer = [...contextAfter];
preImageLine += contextAfter.length;
i = j;  // Skip past context lines already collected into contextAfter
```

This ensures `contextBefore` for each edit contains exactly the context lines between the previous edit and this one — no duplicates.

### Fix 2: Replace `expandWithContext` with preImage-based expansion

#### 2a: Track edit position in preImage

Add `preImageStartLine` to `AtomicEdit` — the 0-indexed line number in the preImage where the edit's old content begins (for deletions/replacements) or where the insertion should go (for insertions). `parseHunksIntoEdits` already tracks `preImageLine`, so this is a simple addition at edit creation time.

**File**: `diff-to-modifications.ts` — `AtomicEdit` type and `parseHunksIntoEdits`

#### 2b: New `expandBlockAnchor` function (deletions/replacements)

Replaces `expandWithContext` for the deletion and replacement cases:

1. Try the full hunk context first (`joinLines(contextBefore) + oldBlock + joinLines(contextAfter)`). If unique, return immediately.
2. If not unique, read lines directly from the preImage before and after the edit position (`preImageStartLine`), progressively expanding outward (1 line, 2 lines, etc.) until the anchor becomes unique or we hit a limit (200 lines).
3. Build `where` and `content` from the expanded preImage context. Context lines are unchanged, so they're the same in both `where` and `content` — only the `oldBlock`/`newBlock` portion differs.

**File**: `diff-to-modifications.ts` — new function, replacing `expandWithContext`

#### 2c: New `expandInsertionAnchor` function (insertions)

For insertions where the simple `contextBefore`/`contextAfter` anchor isn't unique:

1. Try expanding the before-context (lines before the insertion point) from the preImage until unique, returning a `{ after: ... }` modification.
2. If that fails, try expanding the after-context (lines after the insertion point) from the preImage until unique, returning a `{ before: ... }` modification.

**File**: `diff-to-modifications.ts` — new function

#### 2d: Update `generateModificationForEdit`

Replace calls to `expandWithContext` with calls to `expandBlockAnchor` (for deletions/replacements) and `expandInsertionAnchor` (for insertions). Pass `preImage` and `preImageStartLine`.

**File**: `diff-to-modifications.ts` — `generateModificationForEdit`

#### 2e: Remove `MAX_CONTEXT_EXPANSION`

The old constant (10) governed the narrowing loop. The new expansion uses a limit of 200 lines (`MAX_PREIMAGE_EXPANSION`), which is sufficient for any practical case.

### Fix 3: Handle trailing newline changes

#### 3a: Parse `\ No newline at end of file` marker

In `parseDiffHunks` (in `create-powerup.ts`), instead of skipping `\ ` lines entirely, detect `\ No newline at end of file` and annotate the preceding `DiffLine` with `noNewline: true`.

Add `noNewline?: boolean` to the `DiffLine` type:

```typescript
type DiffLine = {
  type: DiffLineType;
  content: string;
  noNewline?: boolean;
};
```

When a `\ No newline at end of file` line is encountered, set `noNewline = true` on the most recently pushed line (which could be a context, added, or removed line).

**Files**: `create-powerup.ts` — `DiffLine` type and `parseDiffHunks`; `diff-to-modifications.ts` — `DiffLine` type (if duplicated)

#### 3b: Propagate to `AtomicEdit`

Add `oldNoNewline` and `newNoNewline` flags to `AtomicEdit`, set when the last removed or added line in an edit has `noNewline: true`.

**File**: `diff-to-modifications.ts` — `AtomicEdit` type and `parseHunksIntoEdits`

#### 3c: Adjust content building in `generateModificationForEdit`

When building `oldContent`/`newContent` via `joinLines`, if the last line has `noNewline: true`, strip the trailing `\n` that `joinLines` adds. This makes the `where` string match the actual preImage.

For the pure trailing-newline case (line content identical, only `\n` differs), this produces a valid replacement modification: `where = "}"` (no `\n`), `content = "}\n"` (or vice versa).

**File**: `diff-to-modifications.ts` — `generateModificationForEdit`

### Fix 4: Fix the final fallback in `generateModifications`

Replace the broken incremental-keep logic with sequential application:

1. Apply each modification to the current content (starting from `preImage`).
2. If a modification can be applied (anchor found and unique), keep it and update the current content.
3. If it can't be applied, skip it and emit a warning.
4. After all mods, check if the result matches the postImage. If not, emit a warning.

This keeps every modification whose anchor is findable and unique at application time, and warns if the final result doesn't perfectly match. The user gets a powerup with most changes captured plus a warning about what needs manual attention.

**File**: `diff-to-modifications.ts` — `generateModifications`

## Testing

The existing test suite in `packages/cli/src/private/utils/git/diff-to-modifications.spec.ts` should be extended with cases for:

1. **Multiple edits in one hunk** — verify no context duplication (Bug 1)
2. **Duplicate text blocks** — `--radius` in `:root` and `.dark` with identical surrounding context (Bug 2)
3. **Trailing newline removal** — file ending changes from `}\n` to `}` (Bug 3)
4. **Trailing newline addition** — file ending changes from `}` to `}\n` (Bug 3)
5. **Partial validation failure** — most mods valid, one invalid; verify valid mods are kept (Bug 4)
6. **Regression** — all existing test cases should still pass

## Impact

After these fixes, the `create --working-dir` command will correctly capture:
- `client/master.css` — all CSS changes (imports, variable replacements, radius changes, font changes, html rule)
- `tsconfig.json` — path alias changes and trailing newline change
- Any file with duplicate text blocks, multiple edits per hunk, or trailing newline changes