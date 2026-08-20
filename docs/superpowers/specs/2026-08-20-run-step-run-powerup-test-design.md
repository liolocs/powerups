# Run Step & Run Powerup Test Design

## Overview

Two new spec files testing the dispatch layer (`run-step.ts`) and the orchestration layer (`run-powerup/index.ts`). These are purely additive test files — no production code changes.

## File Structure

```
run-powerup/
  run-step.spec.ts          — NEW (4 tests, dispatch logic)
  run-powerup.spec.ts       — NEW (3 tests, full flow integration)
  index.ts                  — existing (no changes)
  run-step.ts               — existing (no changes)
```

## run-step.spec.ts (4 tests)

Tests the dispatcher in isolation — focuses on logic unique to `runStep` that isn't covered by the individual step runner specs.

### Test 1: Routes to create step

Call `runStep` with a create step. Verify:
- File is created at the resolved path in destination
- Returned `manifest.stepType` equals `"create"`
- Returned `manifest.status` equals `"applied"`

### Test 2: Resolves variableMap before dispatching

Call `runStep` with a create step that has `variableMap: { name: "{{componentName}}" }` and variables `{ componentName: "Widget" }`. The step's `outputPath` uses `{{name}}` (not `{{componentName}}`). Verify:
- File is created at path using the mapped variable (e.g., `src/Widget.ts`)
- Confirms `resolveStepVariables` is called and maps `componentName` → `name` before dispatching

### Test 3: Passes through variableUpdate from read step

Call `runStep` with a read step (reads a file, sets a variable). Verify:
- Returned `variableUpdate` is present
- `variableUpdate.name` matches the step's `as` field
- `variableUpdate.value` matches the file content (or JSON path value)
- Confirms the `{ manifest, variableUpdate }` wrapper return type works

### Test 4: Throws on unsupported step type

Call `runStep` with `{ type: "unknown", ... }` (via `@ts-expect-error`). Verify:
- Throws `unsupported_step_type` error
- Use `throwsAsync` pattern for async throw assertion

## run-powerup.spec.ts (3 tests)

Tests the full orchestration flow with real step runners, real files, and real manifest output.

### Test 1: Read → create flow (non-dry-run)

**Setup:** Create a source file `config.json` in destination with content `{ "port": 3000 }`.

**Instructions:**
1. Read step: reads `config.json`, jsonPath `port`, stores as variable `serverPort`
2. Create step: uses `{{serverPort}}` in template to create `server.ts`

**Asserts:**
- `server.ts` exists in destination with correct content (incorporating the read variable `3000`)
- `manifest.jsonl` exists in powerup directory
- Read manifest back, parse JSON array:
  - 2 entries
  - Entry 1: `stepType: "read"`, `status: "applied"`, `output.type: "read"`
  - Entry 2: `stepType: "create"`, `status: "applied"`, `output.type: "create"`
- Confirms variable threading between steps + manifest persistence

### Test 2: Dry-run of same flow

**Setup:** Same as test 1 — create `config.json` in destination.

**Instructions:** Same as test 1, but `isDryRun: true`.

**Asserts:**
- No `manifest.jsonl` in powerup directory
- Destination contains only the pre-existing `config.json` — no `server.ts` created
- Confirms dry-run produces zero side effects (no manifest, no created files)

### Test 3: Create → delete flow (non-dry-run)

**Instructions:**
1. Create step: creates `component.ts` from a template
2. Delete step: deletes `component.ts`

**Asserts:**
- `component.ts` does NOT exist (created then deleted)
- `manifest.jsonl` exists in powerup directory
- Read manifest back, parse JSON array:
  - 2 entries
  - Entry 1: `stepType: "create"`, `status: "applied"`, `output.type: "create"`
  - Entry 2: `stepType: "delete"`, `status: "applied"`, `output.type: "delete"`
- Confirms multi-step flow with different step types works end-to-end

## Shared Test Conventions

Both spec files follow existing `utils/use/` test patterns:
- Import `test` from `#test-utils/test/index`
- Import `fs` from `@rcompat/fs`, `runtime` from `@rcompat/runtime`
- `setupTestDir()` / `cleanup()` helpers
- Descriptive test dir names: `run-step-test-powerup`, `run-step-test-destination`, `run-powerup-test-powerup`, `run-powerup-test-destination`
- Template files created in the powerup dir for create steps
- Destructure `{ manifest }` or `{ manifest, variableUpdate }` from results
- `fs.write` adds trailing `\n` — account for this in content assertions

## What Is NOT Tested Here

- Individual step runner behavior (already covered by their own specs: `run-create-step.spec.ts`, `run-modify-step.spec.ts`, `run-read-step.spec.ts`, `run-delete-step.spec.ts`, `run-install-step.spec.ts`)
- Install step in integration flows (requires real package manager commands)
- `printStepSummary` output (side-effect-only, tested implicitly via flow tests but not explicitly asserted)
- `saveManifest` in isolation (tested implicitly via manifest content verification in flow tests)