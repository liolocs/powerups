# Run Read Step Design

## Overview

The read step reads a file from the user's project (destination), processes it in one of three modes, and stores the result as a variable that subsequent steps can reference via `{{varname}}` tokens. This is the third step runner implementation in the new `use` command flow, following `runCreateStep` and `runModifyStep`.

Unlike create and modify, the read step produces a **variable side effect** — its output isn't a file on disk, but a value threaded into the shared variables object for subsequent steps to consume. This requires a new return type from step runners.

## Architecture: Variable Threading

### Problem

In the current system, `runPowerup` iterates over steps and passes a shared `variables` object to each via `runStep`. Inside `runStep`, `resolveStepVariables` creates a **copy** of the variables object (with step-level `variableMap` applied). If a step runner mutates its copy, the mutation doesn't propagate to the shared `variables` object — subsequent steps won't see new variables.

### Solution: Explicit Return

Step runners return a wrapper object instead of a bare manifest:

```ts
type StepRunnerResult = {
  manifest: Omit<ManifestEntry, BaseManifestProperties>;
  variableUpdate?: { name: string; value: string };
};
```

**Flow:**
1. Each step runner returns `{ manifest, variableUpdate? }`
2. `runStep` passes this through to `runPowerup`
3. `runPowerup` destructures `{ manifest, variableUpdate }` from the result
4. If `variableUpdate` exists, `runPowerup` sets `variables[variableUpdate.name] = variableUpdate.value` on the shared `variables` object
5. Next step's `resolveStepVariables` copies the now-updated `variables` object, so the new variable is visible

**Why a wrapper, not extending the manifest:** `saveManifest` does `JSON.stringify(manifest)`. If `variableUpdate` were attached to the manifest object, the variable's value (potentially large file content) would leak into the manifest file. The wrapper keeps them separate — `saveManifest` receives only `manifest`.

### Impact on Existing Step Runners

`runCreateStep`, `runModifyStep`, and `runInstallStep` wrap their return values in `{ manifest: ... }`. Each function's return statements change from `return manifest` to `return { manifest }`, and from `return { ...manifest, status: ..., output: ... }` to `return { manifest: { ...manifest, status: ..., output: ... } }`.

Existing spec files destructure `manifest` from the result: `const { manifest } = await runCreateStep(...)` instead of `const manifest = await runCreateStep(...)`. Existing manifest field assertions remain unchanged.

## Read Step Logic

### Path Resolution

`step.path` contains `{{var}}` tokens. We resolve it using `applyVariablesToTemplateString` directly (the same function `resolveOutputPath` wraps in `shared/`). The resolved path points into the destination directory.

We call `applyVariablesToTemplateString` directly rather than reusing `resolveOutputPath` from `shared/` because its parameter name (`outputPath`) is misleading for the read step's `path` field.

### Three Processing Modes

The read step supports three modes, determined by which optional fields are present on the `ReadStep`:

1. **Template mode** (`step.template` is set): The file content is passed as a special `__content` variable to the template renderer, alongside all step variables. The template renders and returns the processed value. We reuse `renderTemplate` from `run-create-step/render-template.ts` — it handles the template-not-found check and calls `runTemplate`. We pass `{ ...variables, __content: content }` as the variables.

2. **JSON path mode** (`step.jsonPath` is set, no template): The file content is parsed as JSON, then a dot-separated path navigates to the target value. If JSON parsing fails → throw `read_json_parse_error`. If the path doesn't resolve → throw `read_json_path_not_found`. The navigation logic lives in a separate `navigate-json-path.ts` utility.

3. **Raw mode** (neither template nor jsonPath): The file content is used as-is.

### Error Handling

The read step throws on all errors — file not found (`read_file_not_found`), JSON parse error (`read_json_parse_error`), JSON path not found (`read_json_path_not_found`), template not found (`template_not_found`). No try/catch wrapper. If the read fails, execution stops.

This is intentional and different from the modify step's "catch all" philosophy: subsequent steps depend on the read variable, so continuing would produce cascading failures. A read failure is a hard dependency failure.

### Dry-Run

Identical to non-dry-run. The file is always read, the variable is always set. The read step never writes to disk, so there is no dry-run distinction. If the file doesn't exist in dry-run, the step throws — the user should know about missing dependencies before committing to a real run.

### Manifest

Always `applied` with `ReadOutput`:

```ts
{
  timestamp: new Date(),
  stepName: step.name,
  from: step.from?.name,
  stepType: "read",
  status: "applied",
  output: { type: "read", variable: step.as },
}
```

Plus `variableUpdate: { name: step.as, value: resolvedValue }` in the wrapper.

There is no `skipped-warning` case for the read step — it either succeeds or throws.

## File Decomposition

### New Files

```
run-read-step/
  index.ts                    — orchestrator
  navigate-json-path.ts        — pure utility: navigates a JSON object by dot-separated path
  navigate-json-path.spec.ts   — tests for the utility
  run-read-step.spec.ts        — integration tests for the orchestrator
```

**Why `navigate-json-path.ts` is separate:** It's a pure function (`(json: unknown, path: string) => string`) with clear error cases (path not found, non-object traversal). Independently testable, no async dependencies, no file I/O. Worth its own file + spec.

**Why no `read-file-content.ts`:** The three-mode processing (template / jsonPath / raw) is only ~10 lines in the orchestrator. Extracting it would create a function with heavy dependencies (`powerupDirectory`, `variables`, `runTemplate`) that's harder to test in isolation than the orchestrator itself. Not worth the indirection.

**Why no `resolve-read-path.ts`:** Path resolution is a single call to `applyVariablesToTemplateString`. Creating another wrapper file for a one-liner adds indirection without value.

**Why reuse `renderTemplate` from `run-create-step`:** The read step's template mode needs the same template-not-found check + `runTemplate` call. `renderTemplate` already does both. We pass `{ ...variables, __content: content }` as the variables. This is within `utils/use/` so the import is allowed. No need to move it to `shared/` — the read step is the only other consumer, and moving it would be a larger change for minimal benefit.

### Modified Files

- `run-step.ts` — register read step, update return types
- `run-powerup/index.ts` — destructure wrapper, handle `variableUpdate`, add read case to `printStepSummary`
- `run-create-step/index.ts` — wrap returns in `{ manifest }`
- `run-modify-step/index.ts` — wrap returns in `{ manifest }`
- `run-install-step/index.ts` — wrap returns in `{ manifest }`
- `run-create-step.spec.ts` — destructure `manifest` from result
- `run-modify-step.spec.ts` — destructure `manifest` from result
- `run-install-step.spec.ts` — destructure `manifest` from result (if applicable)

## Printing

`printStepSummary` in `run-powerup/index.ts` gains a read case:

- `Read: ${output.variable}` for `output.type === "read"` and `status === "applied"`

This shows the variable name that was set, e.g. `Read: packageName`.

The existing print patterns remain:
- `Created: ${output.path}` for create/applied
- `Modified: ${output.path}` for modify/applied
- `Installed dependencies` for install/applied
- `Skipped: ${stepName}` for skipped-warning

## Testing Strategy

### `navigate-json-path.spec.ts` (pure utility, ~5 tests)

- Navigates a nested dot path (`user.profile.name` → value)
- Navigates to a top-level key (`config` → value)
- Throws when path doesn't exist (`user.nonexistent` on an object without that key)
- Throws when traversing through a non-object (`user.name.length` where `name` is a string)
- Returns string representation of the final value (number → string)

`navigateJsonPath` throws generic `Error` (not `use_errors`) — it doesn't have the file path needed for `use_errors` error messages. The orchestrator catches and rethrows as `use_errors.read_json_path_not_found`. Tests use try/catch with a boolean flag pattern (set `threw = true` in catch, assert `threw` is true). No `setupTestDir`/`cleanup` needed — pure function, no filesystem.

### `run-read-step.spec.ts` (integration, ~7 tests)

- Reads a file in raw mode and returns `applied` manifest with `ReadOutput` (variable name matches `step.as`)
- Reads a JSON file with `jsonPath` and returns the resolved value
- Throws `read_file_not_found` when target file doesn't exist
- Throws `read_json_parse_error` when file is not valid JSON and `jsonPath` is set
- Throws `read_json_path_not_found` when JSON path doesn't resolve
- Template mode: reads file content, passes as `__content` to template, stores rendered output
- Variable threading: calls `runReadStep` twice — first read stores a variable, second read's path uses `{{thatVariable}}` to resolve its path (verifies the `variableUpdate` mechanism)

All filesystem tests use `setupTestDir()`/`cleanup()` helpers with named test directories, following the `run-modify-step.spec.ts` pattern. Async throws use `await assert(fn(...)).throwsAsync(UseErrorCode.X)`.

### Existing Spec Updates

- `run-create-step.spec.ts`: destructure `{ manifest }` from result — 6 tests
- `run-modify-step.spec.ts`: destructure `{ manifest }` from result — 8 tests
- `run-install-step.spec.ts`: destructure `{ manifest }` from result (if tests check the return)