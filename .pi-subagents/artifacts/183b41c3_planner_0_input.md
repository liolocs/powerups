# Task for planner

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Create a detailed implementation plan for the new install command design spec at docs/superpowers/specs/2026-08-21-install-command-new-design.md.

Key context:
- This is for the powerups-oss monorepo, packages/cli directory
- The spec describes recreating the `pup install` command from scratch
- Follow the same conventions as the create command implementation (see packages/cli/src/private/utils/create/ for examples)
- Tests use `import test from "#test-utils/test/index"` (NOT @rcompat/test directly)
- Use `npx proby <path-to-spec>` to run tests
- The plan should cover all files listed in the spec's architecture section
- Read the spec file first, then explore the codebase patterns (especially utils/create/ and utils/install/ for existing code)
- The spec file path: docs/superpowers/specs/2026-08-21-install-command-new-design.md

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powerups/powerups-oss/.pi-subagents/artifacts/outputs/183b41c3/plan.md
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