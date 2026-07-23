# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You need to fix the test files `packages/cli/src/private/utils/check-output.spec.ts` and `packages/cli/src/private/utils/validate-output.spec.ts`. These files were partially updated but still have test data using the old `output` + `includes` format. You need to convert ALL test data to the new `steps` format.

## Transformation Rules

1. Replace `"output": { "create": [...], "modify": [...], "delete": [...] }` with `"steps": [...]` where:
   - Each `output.create` entry `{ name, template, outputPath }` becomes `{ type: "create", name, template, outputPath }`
   - Each `output.modify` entry `{ name, template, outputPath }` becomes `{ type: "modify", name, template, outputPath }`
   - Each `output.delete` entry `{ name, outputPath }` becomes `{ type: "delete", name, outputPath }`
   - Order: create entries first, then modify entries, then delete entries

2. Replace `"includes": [...]` entries — move them INTO the `steps` array as `{ type: "include", name, variables, ... }` entries (after the create/modify/delete steps)

3. Replace `"exclude": { "create": ["x"], "modify": ["y"] }` with `"excludeSteps": ["x", "y"]` (flatten all kind arrays into one)

4. Replace `"outputPathOverride": { "create": { "x": "path" } }` with `"stepOverride": { "x": { "type": "create", "template": "<child's template>", "outputPath": "path" } }` — look up the child's step to get the template value

## What's wrong

The `check-output.ts` and `validate-output.ts` source files have ALREADY been updated to the new format (they walk `instructions.steps` instead of `instructions.output`/`instructions.includes`). But the SPEC FILES still have test data in the old format. When the tests try to parse old-format data with the new schema, parsing either fails or the validation logic doesn't find what it expects.

You need to update the test data in both spec files to use the `steps` format so the tests exercise the new validation logic correctly.

## Important: Understanding the new validation logic

The new `check-output.ts` validates:
- Schema conformance (pema parse)
- Required/optional collision
- Optional variable used in output path (walks steps for create/modify/delete)
- Template file existence (walks steps for create/modify/read-template)
- Step name uniqueness (NEW)
- Variable ordering (NEW — walk steps in order, track available vars, flag tokens used before available)
- Read `as` collision (NEW — read step `as` shouldn't shadow declared variable)

The new `validate-output.ts` validates:
- Include step existence, cycles, variable mapping
- stepOverride keys match child step names
- excludeSteps names match child step names
- stepOverride/excludeSteps conflict

Make sure the test data exercises these new validations correctly.

## Verification

After fixing, create and run:
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
bun --conditions="@powerups/source" run-single-test.ts src/private/utils/check-output.spec.ts
bun --conditions="@powerups/source" run-single-test.ts src/private/utils/validate-output.spec.ts
rm run-single-test.ts
```

Both must show 0 failures.

## Commit

```bash
cd packages/cli
git add src/private/utils/check-output.spec.ts src/private/utils/validate-output.spec.ts
git commit -m "fix: update check-output and validate-output spec tests for steps format"
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