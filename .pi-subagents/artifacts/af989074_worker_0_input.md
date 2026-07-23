# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Task 1: New Schema (`instruction.ts`)

## Task Description

**Files:**
- Modify: `packages/cli/src/private/schemas/instruction.ts`
- Modify: `packages/cli/src/private/schemas/instruction.spec.ts`

### Step 1: Rewrite `instruction.ts` with the new steps schema

Replace the entire contents of `packages/cli/src/private/schemas/instruction.ts`:

```typescript
import p from "pema";

// ── Step schemas (discriminated union on `type`) ─────────────────────

const createStepSchema = p({
  type: p.literal("create"),
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

const modifyStepSchema = p({
  type: p.literal("modify"),
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

const deleteStepSchema = p({
  type: p.literal("delete"),
  name: p.string,
  outputPath: p.string,
});

const readStepSchema = p({
  type: p.literal("read"),
  name: p.string,
  path: p.string,
  as: p.string,
  jsonPath: p.string.optional(),
  template: p.string.optional(),
});

// Step override value schemas (step minus `name`) — derived via p.omit
const createStepOverrideSchema = p.omit(createStepSchema, "name");
const modifyStepOverrideSchema = p.omit(modifyStepSchema, "name");
const deleteStepOverrideSchema = p.omit(deleteStepSchema, "name");
const readStepOverrideSchema = p.omit(readStepSchema, "name");

const stepOverrideValueSchema = p.union(
  createStepOverrideSchema,
  modifyStepOverrideSchema,
  deleteStepOverrideSchema,
  readStepOverrideSchema,
);

const includeStepSchema = p({
  type: p.literal("include"),
  name: p.string,
  variables: p.record(p.string, p.string),
  stepOverride: p.record(p.string, stepOverrideValueSchema).optional(),
  excludeSteps: p.array(p.string).optional(),
});

export const stepSchema = p.union(
  createStepSchema,
  modifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  includeStepSchema,
);

export const stepsSchema = p.array(stepSchema);

// ── Package dependencies (unchanged) ─────────────────────────────────

const packageDependencyGroupSchema = p({
  target: p.string.optional(),
  dependencies: p.array(p.string).optional(),
  devDependencies: p.array(p.string).optional(),
  peerDependencies: p.array(p.string).optional(),
});

// ── Top-level instructions ─────────────────────────────────────────

export const instructionsSchema = p({
  name: p.string,
  description: p.string,
  variables: p({
    required: p.array(p.string),
    optional: p.array(p.string).optional(),
  }),
  intent: p.array(p.string),
  packageDependencies: p.array(packageDependencyGroupSchema).optional(),
  steps: stepsSchema,
});

export const packageDependencyGroupArraySchema = p.array(packageDependencyGroupSchema);

export type Step = (typeof stepSchema)["infer"];
export type StepOverrideValue = (typeof stepOverrideValueSchema)["infer"];
export type Instructions = (typeof instructionsSchema)["infer"];
```

### Step 2: Rewrite `instruction.spec.ts` with tests for the new schema

Replace the entire contents of `packages/cli/src/private/schemas/instruction.spec.ts` with tests covering all 5 step types, stepOverride, excludeSteps, empty steps, packageDependencies, required/optional variables, and rejection cases (missing steps, missing name, missing as, missing variables, missing description, old output format, old includes format).

Key test cases to include:
- Parse instructions with create steps
- Parse instructions with modify steps
- Parse instructions with delete steps
- Parse instructions with read step (jsonPath mode)
- Parse instructions with read step (template mode)
- Parse instructions with read step (raw mode)
- Parse instructions with include step
- Parse include step with stepOverride
- Parse include step with excludeSteps
- Parse instructions with mixed step types in order
- Parse instructions with empty steps array
- Parse instructions with packageDependencies
- Parse instructions with required and optional variables
- Reject: missing steps, create step missing name, read step missing as, include step missing variables, missing description, old output format, old includes format

Use the test pattern from the existing file: `import test from "@rcompat/test"` with `test.case("...", async assert => { ... })`.

### Step 3: Run tests to verify they pass

Run: `cd packages/cli && npx proby --filter instruction`
Expected: All cases PASS

### Step 4: Commit

```bash
cd packages/cli
git add src/private/schemas/instruction.ts src/private/schemas/instruction.spec.ts
git commit -m "feat: replace output+includes schema with unified steps array"
```

## Context

This is the first task in a 16-task plan to replace the `output` + `includes` schema with a unified `steps` array. This is a hard breaking change — no backward compatibility needed. The project uses pema for schema validation (similar to zod). The test framework is @rcompat/test with `test.case()` and `assert` pattern. The test runner is proby (run via `npx proby`).

Key import patterns:
- `#schemas/instruction` resolves to `./src/private/schemas/instruction.ts` (source mode)
- Tests use `import test from "@rcompat/test"`

The existing `instruction.ts` exports: `instructionsSchema`, `outputSchema`, `packageDependencyGroupArraySchema`, `Instructions`, `SuboutputRef`. After this change, it should export: `instructionsSchema`, `stepSchema`, `stepsSchema`, `packageDependencyGroupArraySchema`, `Step`, `StepOverrideValue`, `Instructions`. The old `outputSchema` and `SuboutputRef` are eliminated.

Work from: /Users/lioloc/Development/powers/powers_dev/.worktrees/steps-and-read-step

IMPORTANT: Do NOT try to run the full test suite or build — other files still reference the old schema. Only run the instruction spec tests specifically. Other tests will break and that's expected — they'll be fixed in subsequent tasks.

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