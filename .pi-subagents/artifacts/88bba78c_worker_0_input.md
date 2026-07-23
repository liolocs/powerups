# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Tasks 7, 8, 9, 10, 11, and 13 from the steps+read implementation plan. These are all mechanical updates to existing files that walk `instructions.includes` or `instructions.output.*` — they need to walk `instructions.steps` instead.

## Task 7: Update `dependencies.ts`

**File:** `packages/cli/src/private/utils/dependencies.ts`

In the `collectDependencies` function, replace the `instructions.includes` iteration with steps filtering:

```typescript
// Before:
if (is.defined(instructions.includes) && is.truthy(instructions.includes)) {
  for (const ref of instructions.includes) {
    const childDeps = await collectDependencies({
      outputName: ref.name,
      outputsFolder,
    });
    deps.push(...childDeps);
  }
}

// After:
for (const step of instructions.steps) {
  if (step.type === "include") {
    const childDeps = await collectDependencies({
      outputName: step.name,
      outputsFolder,
    });
    deps.push(...childDeps);
  }
}
```

Also update `packages/cli/src/private/utils/dependencies.spec.ts` — transform ALL test data from `output` + `includes` format to `steps` format (same transformation rules as before: create entries → `{ type: "create", ... }`, includes entries → `{ type: "include", ... }` in the steps array, exclude → excludeSteps, outputPathOverride → stepOverride).

## Task 8: Update `info` command

**File:** `packages/cli/src/private/commands/info/index.ts`

Update `collectInfo` to walk `instructions.steps` instead of `output.create`/`modify`/`delete` + `includes`. Key changes:
1. Replace the three separate loops (create/modify/delete) with a single loop over `instructions.steps`
2. For `type === "create"`: push to files with `kind: "create"`
3. For `type === "modify"`: push to files with `kind: "modify"`
4. For `type === "delete"`: push to files with `kind: "delete"`
5. For `type === "read"`: push to a new `reads` array
6. For `type === "include"`: build include summary, resolve child variables, recurse
7. Replace `ref.outputPathOverride?.create/modify/delete` with `step.stepOverride ?? {}` (flat map)
8. Replace `ref.exclude?.create/modify/delete` with `step.excludeSteps ?? []` (flat array)
9. Add a "Reads" section to the display output

Also update `packages/cli/src/private/commands/info/info.spec.ts` — transform ALL test data to steps format.

## Task 9: Update `find` command

**File:** `packages/cli/src/private/commands/find/index.ts`

One-line change:
```typescript
// Before:
fileCount: output.output.create.length + output.output.modify.length,
// After:
fileCount: output.steps.filter(s => s.type === "create" || s.type === "modify").length,
```

Also update `packages/cli/src/private/commands/find/find.spec.ts` — transform test data to steps format.

## Task 10: Update `validate` command

**File:** `packages/cli/src/private/commands/validate/index.ts`

Replace the `instructions.includes` iteration with steps filtering:
```typescript
// Before:
if (is.defined(instructions.includes)) {
  for (const include of instructions.includes) {
    const subPowerFolder = typeFolder.append(`/${include.name}`);
    // ...
  }
}

// After:
for (const step of instructions.steps) {
  if (step.type === "include") {
    const subPowerFolder = typeFolder.append(`/${step.name}`);
    // ... same validation logic, using step.name instead of include.name
  }
}
```

Also update `packages/cli/src/private/commands/validate/validate.spec.ts` — transform test data to steps format.

## Task 11: Update `doctor` command

**File:** `packages/cli/src/private/commands/doctor/index.ts`

Two changes:
1. Template file reference collection — walk steps:
```typescript
// Before:
for (const f of instructions.output.create) { referencedFiles.add(f.template); }
for (const f of instructions.output.modify) { referencedFiles.add(f.template); }
// After:
for (const step of instructions.steps) {
  if (step.type === "create" || step.type === "modify") { referencedFiles.add(step.template); }
  if (step.type === "read" && step.template) { referencedFiles.add(step.template); }
}
```

2. Modify template validation — walk steps:
```typescript
// Before:
for (const modifyEntry of instructions.output.modify) { ... }
// After:
for (const step of instructions.steps) {
  if (step.type !== "modify") continue;
  // ... same logic using step.template instead of modifyEntry.template
}
```

Also update `packages/cli/src/private/commands/doctor/doctor.spec.ts` — transform test data to steps format.

## Task 13: Update `move/collect.ts`

**File:** `packages/cli/src/private/utils/move/collect.ts`

Replace `instructions.includes` iteration with steps filtering:
```typescript
// Before:
if (is.defined(instructions.includes)) {
  for (const ref of instructions.includes) {
    if (collected.has(ref.name)) continue;
    // ... resolve, recurse using ref.name
  }
}

// After:
for (const step of instructions.steps) {
  if (step.type !== "include") continue;
  if (collected.has(step.name)) continue;
  // ... resolve, recurse using step.name
}
```

Also update `packages/cli/src/private/utils/move/collect.spec.ts` — transform test data to steps format.

## Transformation Rules (for all spec files)

1. `"output": { "create": [...], "modify": [...], "delete": [...] }` → `"steps": [...]` where each entry gets `type` field
2. `"includes": [...]` → move into `steps` array as `{ type: "include", ... }` entries
3. `"exclude": { "create": ["x"] }` → `"excludeSteps": ["x"]`
4. `"outputPathOverride": { "create": { "x": "path" } }` → `"stepOverride": { "x": { "type": "create", "template": "<child template>", "outputPath": "path" } }`

## Verification

After all changes, verify each spec file passes using this test runner:
```bash
cd packages/cli
cat > run-single-test.ts << 'SCRIPT'
import repository from "@rcompat/test/repository";
import fs from "@rcompat/fs";
import path from "node:path";
const fileArg = process.argv[2];
if (!fileArg) { console.error("Usage: bun run run-single-test.ts <spec-file-path>"); process.exit(1); }
const filePath = path.resolve(fileArg);
const file = fs.ref(filePath);
repository.suite(file);
const suite = repository.next().next().value;
await file.import();
let passed = 0, failed = 0;
const iter = suite.run()[Symbol.asyncIterator]();
while (true) {
  const { done, value } = await iter.next();
  if (done || !value) break;
  const { test, duration } = value;
  const testFailed = test.results.some((r) => !r.passed);
  if (testFailed) { failed++; console.log(`  ✗ ${test.name}`); for (const r of test.results) { if (!r.passed) { console.log(`    Expected: ${r.expected}`); console.log(`    Actual:   ${r.actual}`); } } }
  else { passed++; console.log(`  ✓ ${test.name}`); }
}
console.log(`\n${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);
SCRIPT

for spec in dependencies info find validate doctor move/collect; do
  echo "=== $spec ==="
  bun --conditions="@powerups/source" run-single-test.ts src/private/utils/${spec}.spec.ts 2>&1 | tail -5 || \
  bun --conditions="@powerups/source" run-single-test.ts src/private/commands/${spec}/${spec}.spec.ts 2>&1 | tail -5
done

rm run-single-test.ts
```

## Commits

Make one commit per task or one combined commit. Use descriptive messages like:
```bash
git commit -m "feat: update dependencies, info, find, validate, doctor, move/collect for steps schema"
```

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```