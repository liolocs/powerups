# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Task 4: Update the `use` command.

## What to do

### Part 1: Update `packages/cli/src/private/commands/use/index.ts`

The use command currently uses a two-phase approach: `resolveOutput()` builds a flat `RenderTask[]`, then the command iterates tasks. Replace this with `executeSteps()`.

Changes needed:

1. **Replace imports**: Remove `import { resolveOutput } from "#utils/resolve";` and add `import { executeSteps } from "#utils/execute-steps";`

2. **Remove the `resolveOutput` call** (currently around line 130):
```typescript
// Remove this:
const tasks = await resolveOutput({
  outputName: name,
  variables,
  outputsFolder: typeFolder,
});
```

3. **Replace the dry-run block** (the `if (is.truthy(isDryRun))` block that iterates `tasks`). Replace the entire block with:
```typescript
if (is.truthy(isDryRun)) {
  await executeSteps({
    steps: instructions.steps,
    variables,
    outputFolder,
    rootDir: root,
    worktreeRoot: undefined,
    outputsFolder: typeFolder,
    isDryRun: true,
    isOverwrite,
    changedFiles: [],
  });

  // Process packageDependencies in dry-run mode
  if (instructions.packageDependencies || instructions.steps.some(s => s.type === "include")) {
    const collectedDeps = await collectDependencies({ outputName: name, outputsFolder: typeFolder });

    if (collectedDeps.length > 0) {
      await applyDependencies({
        projectRoot: root,
        packageDependencies: collectedDeps,
        isDryRun: true,
      });
    }
  }

  return;
}
```

4. **Replace the real-mode task iteration** (the `for (const task of tasks)` loop inside the `try` block). Replace the entire `let totalCharacters = 0; try { for (const task of tasks) { ... } } catch { ... }` with:
```typescript
let totalCharacters = 0;

try {
  totalCharacters = await executeSteps({
    steps: instructions.steps,
    variables,
    outputFolder,
    rootDir: root,
    worktreeRoot: worktree.root,
    outputsFolder: typeFolder,
    isDryRun: false,
    isOverwrite,
    changedFiles,
  });
} catch (error) {
  await removeWorktree(root, worktree.path);
  throw error;
}
```

5. **Update the packageDependencies check**:
```typescript
// Before:
if (instructions.packageDependencies || instructions.includes) {
// After:
if (instructions.packageDependencies || instructions.steps.some(s => s.type === "include")) {
```

6. **Remove unused imports**: Remove `resolveOutputPath` import if no longer used (check — it might still be needed elsewhere). Also remove `RenderTask` type import if present.

### Part 2: Update `packages/cli/src/private/commands/use/use.spec.ts`

This file has ~1784 lines with ~30+ test cases. ALL test data uses the old `output` + `includes` format and needs to be transformed to the new `steps` format.

**Transformation rules:**

1. Replace `"output": { "create": [...], "modify": [...], "delete": [...] }` with `"steps": [...]` where:
   - Each `output.create` entry `{ name, template, outputPath }` becomes `{ type: "create", name, template, outputPath }`
   - Each `output.modify` entry `{ name, template, outputPath }` becomes `{ type: "modify", name, template, outputPath }`
   - Each `output.delete` entry `{ name, outputPath }` becomes `{ type: "delete", name, outputPath }`
   - Order: create entries first, then modify entries, then delete entries

2. Replace `"includes": [...]` entries — move them INTO the `steps` array as `{ type: "include", name, variables, ... }` entries (after the create/modify/delete steps)

3. Replace `"exclude": { "create": ["x"], "modify": ["y"] }` with `"excludeSteps": ["x", "y"]` (flatten all kind arrays into one)

4. Replace `"outputPathOverride": { "create": { "x": "path" } }` with `"stepOverride": { "x": { "type": "create", "template": "<lookup child's template>", "outputPath": "path" } }` — you need to look up the child's step to get the template value. If no outputPathOverride exists, don't add stepOverride.

For example, old format:
```javascript
{
  name: "test-output",
  description: "test",
  variables: { required: ["componentName"] },
  intent: [],
  output: {
    create: [{ name: "component", template: "component.svelte.tmpl", outputPath: ".test-output/{{componentName}}.svelte" }],
    modify: [{ name: "index", template: "modify-index.json", outputPath: ".test-output/index.ts" }],
  },
}
```

Becomes:
```javascript
{
  name: "test-output",
  description: "test",
  variables: { required: ["componentName"] },
  intent: [],
  steps: [
    { type: "create", name: "component", template: "component.svelte.tmpl", outputPath: ".test-output/{{componentName}}.svelte" },
    { type: "modify", name: "index", template: "modify-index.json", outputPath: ".test-output/index.ts" },
  ],
}
```

And for includes, old:
```javascript
{
  name: "parent",
  ...
  output: { create: [], modify: [] },
  includes: [{ name: "child", variables: { componentName: "Button" }, exclude: { create: ["bar"] } }],
}
```

Becomes:
```javascript
{
  name: "parent",
  ...
  steps: [{ type: "include", name: "child", variables: { componentName: "Button" }, excludeSteps: ["bar"] }],
}
```

Apply this transformation to ALL test cases in the file. Be thorough — every single test case that creates powerup instructions needs updating.

### Part 3: Commit

```bash
cd packages/cli
git add src/private/commands/use/index.ts src/private/commands/use/use.spec.ts
git commit -m "feat: update use command to use executeSteps"
```

## Context

- The new `executeSteps` function is in `packages/cli/src/private/utils/execute-steps.ts`
- It takes `{ steps, variables, outputFolder, rootDir, worktreeRoot?, outputsFolder, isDryRun, isOverwrite, changedFiles }` and returns `Promise<number>` (totalCharacters)
- Read steps read from `rootDir` (project root), writes go to `worktreeRoot` (or stdout in dry-run)
- The `use` command currently has two separate code paths (dry-run and real) that both iterate a flat `RenderTask[]` — both need to be replaced with `executeSteps` calls
- `outputFolder` is the resolved powerup's folder (already available in the current code as `outputFolder`)
- `typeFolder` is the parent folder containing all powerups (already available)
- `root` is the project root (already available)
- `variables` is the extracted variables (already available)
- `instructions` is the parsed instructions (already available, now has `.steps` instead of `.output`/`.includes`)
- `changedFiles` is already declared before the real-mode block
- `isOverwrite` and `isDryRun` are already computed

To verify your work, create a temporary test runner script:
```typescript
// packages/cli/run-single-test.ts
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
```

Then run: `cd packages/cli && bun --conditions="@powerups/source" run-single-test.ts src/private/commands/use/use.spec.ts`

Delete the test runner script before committing.

Work from: /Users/lioloc/Development/powers/powers_dev/.worktrees/steps-and-read-step

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