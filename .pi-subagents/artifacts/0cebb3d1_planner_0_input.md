# Task for planner

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Create a detailed implementation plan based on the design spec at `docs/superpowers/specs/2026-08-24-powerup-name-resolution-fix-design.md`.

This is a bug fix for the powerups CLI system. The spec describes 12 sections of changes across the SDK and CLI packages. Read the spec carefully and create a phase-by-phase implementation plan.

Key context:
- This is a monorepo with `packages/sdk` and `packages/cli` and `packages/program`
- Tests use `import test from "#test-utils/test/index"` (never `@rcompat/test` directly)
- Test runner: `npx proby <path-to-spec>`
- Type checking: `npx tsc --noEmit` in `packages/cli`
- The spec has 11 source files to change + 2 new files + 8 spec files to update
- All changes are on branch `feat/new-system-install`
- Working directory is `/Users/lioloc/Development/powerups/powerups-oss`

Read the spec file first, then explore the actual source files referenced in the spec to understand current code, then create the plan.

Write the plan to a markdown file and output the path.

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powerups/powerups-oss/.pi-subagents/artifacts/outputs/0cebb3d1/plan.md
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

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