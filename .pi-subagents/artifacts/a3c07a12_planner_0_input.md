# Task for planner

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Create a detailed implementation plan based on the approved design spec at docs/superpowers/specs/2026-07-15-optional-variables-design.md.

The spec covers adding optional/required variable support to the instruction schema in a CLI tool. Key changes:

1. Schema change: `variables` goes from `p.array(p.string)` to `p({ required: p.array(p.string), optional: p.array(p.string).optional() })` in `packages/cli/src/private/schemas/instruction.ts`
2. `extractVariables` in `packages/cli/src/private/utils/variables.ts` → object params, optional defaults to empty string, collect all missing required vars, remove `findMissingVariables`
3. Error message: `missing_variable` → `missing_variables` (plural, lists all missing + example command) in `packages/cli/src/private/errors/outputApplyErrors.ts`
4. `check-output.ts`: add required/optional collision check + optional variable in output path check
5. `create/index.ts`: add `--optional-variables`/`-ov` flag
6. `apply/index.ts`: update `extractVariables` call
7. Migrate `.saved/output/template/cli-command/instructions.json`
8. Update all test files: instruction.spec.ts, variables.spec.ts, apply.spec.ts, create.spec.ts

Read the full spec for complete details.

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/saved/saved_dev/.pi-subagents/artifacts/outputs/a3c07a12/plan.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: required by reviewer.

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