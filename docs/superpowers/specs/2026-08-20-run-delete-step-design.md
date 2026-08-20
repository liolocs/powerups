# Run Delete Step Design

## Overview

`runDeleteStep` is the fourth step runner in the `use` command flow. It deletes a file (or directory) from the user's project at a resolved path. It is the simplest step runner — no templates, no JSON parsing, no variable output.

## SDK Schemas

**`DeleteStep`** (`@liolocs/powerups-sdk`):
```ts
{
  type: "delete",
  name: string,
  outputPath: string,
  variableMap?: Record<string, string>,
  __source?: string,
  from?: { name: string, singleUse: boolean },
}
```

**`DeleteOutput`** (strict — no extra fields):
```ts
{ type: "delete", path: string }
```

**`DeleteManifestEntry`** output union: `deleteOutputSchema | noneOutputSchema`

## Architecture

```
run-delete-step/
  index.ts                  — orchestrator
  run-delete-step.spec.ts    — tests
```

No new utilities. Reuses `resolveOutputPath` from `steps/shared/resolve-output-path.ts`.

## Orchestrator Logic

```
Input: { step: DeleteStep, isDryRun, destination, powerupDirectory, variables }
Output: Promise<{ manifest: Omit<DeleteManifestEntry, BaseManifestProperties> }>
```

### Steps

1. **Resolve path** — call `resolveOutputPath({ outputPath: step.outputPath, variables })` to get `resolvedOutputPath`.
2. **Build default manifest** — construct `applied` manifest with `DeleteOutput`:
   ```ts
   {
     timestamp: new Date(),
     stepName: step.name,
     from: step.from?.name,
     stepType: "delete",
     status: "applied",
     output: { type: "delete", path: resolvedOutputPath },
   }
   ```
3. **Check file existence** — check if file exists at `destination.append("/${resolvedOutputPath}")`.
4. **Skip if file not found** — if the file does NOT exist, return:
   ```ts
   { manifest: { ...manifest, status: "skipped-warning", output: { type: "none" } } }
   ```
5. **Dry-run** — if `isDryRun`, return `{ manifest }` without removing the file. The manifest is `applied` + `DeleteOutput` because the file exists and would be deleted.
6. **Remove file** — call `targetPath.remove()` (recursive by default, silently does nothing if already gone).
7. **Return** `{ manifest }`.

### Key Ordering

The file-existence check (step 3) happens BEFORE the dry-run check (step 5). This ensures dry-run gets an accurate manifest:
- File exists → `applied` + `DeleteOutput` (would delete)
- File doesn't exist → `skipped-warning` + `NoneOutput` (would skip)

The only difference between dry-run and non-dry-run is step 6 (the actual `remove()` call).

## Error Handling

**No errors thrown.** The only failure condition (file not found) is a skip, not an error. This matches:
- The old `execute-steps.ts` behavior (warns and skips)
- The create step's "file already exists → skip" pattern
- The idempotent nature of deletion (deleting a file that's already gone is harmless)

`FileRef.remove()` is also inherently safe — it silently does nothing if the file doesn't exist — but we check existence explicitly to produce the correct manifest status.

## Dry-Run Behavior

Identical to non-dry-run in terms of manifest output. The file's existence is checked, and the manifest reflects what *would* happen. The only difference: `remove()` is not called in dry-run.

This gives the user an accurate preview: if the file exists, the dry-run manifest says `applied` with `DeleteOutput`; if the file doesn't exist, it says `skipped-warning` with `NoneOutput`.

## Variable Threading

Delete does not produce variables. Returns `{ manifest }` only — no `variableUpdate` field. This is consistent with create, modify, and install steps (only the read step returns `variableUpdate`).

## Integration Changes

### `run-step.ts`

- Import `runDeleteStep` from `#utils/use/run-powerup/steps/run-delete-step/index`
- Uncomment `delete: runDeleteStep` in `stepTypes` map
- Add `DeleteStep` to the `step` union type in the function signature

### `run-powerup/index.ts`

Add delete case to `printStepSummary`:
```ts
if (output.type === "delete") {
  cli.print(`Deleted: ${output.path}\n`);
  return;
}
```

## Testing

### Test File: `run-delete-step.spec.ts`

~5 tests following existing `utils/use/` test conventions:

1. **Deletes an existing file** — create a file, run delete step, verify file is removed, verify `applied` + `DeleteOutput` with correct path.
2. **Skips when file does not exist** — run delete step on nonexistent file, verify `skipped-warning` + `NoneOutput`, verify no error thrown.
3. **Dry-run with file existing** — create a file, run delete step with `isDryRun: true`, verify `applied` + `DeleteOutput`, verify file still exists (NOT removed).
4. **Dry-run with file not existing** — run delete step with `isDryRun: true` on nonexistent file, verify `skipped-warning` + `NoneOutput`.
5. **Variable resolution in outputPath** — use `{{componentName}}.ts` as outputPath with a variable, verify the correct file is deleted.

### Test Conventions

- Import `test` from `#test-utils/test/index`
- Import `fs` from `@rcompat/fs`, `runtime` from `@rcompat/runtime`
- Use `setupTestDir()` / `cleanup()` helpers
- Use descriptive test dir names: `run-delete-step-test-powerup`, `run-delete-step-test-destination`
- Destructure `{ manifest }` from `runDeleteStep` result
- `fs.write` adds trailing newline — not relevant for delete (we check existence, not content)