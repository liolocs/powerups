# Task for planner

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Create a detailed implementation plan for the new `create` command design spec at `docs/superpowers/specs/2026-08-20-create-command-new-design.md`.

The spec has been reviewed and approved by the user. It covers:
1. The new `create-new.ts` command that dogfoods the `create-powerup` internal powerup via `runPowerup`
2. Flags: `--capture` (all|workingDir), `--dry-run`, `--local`, `--description`, `--intent`, `--variables`, `--optional-variables`, `--type`
3. Pre-create validation (name, capture flag, description, powerup exists, folder structure)
4. Variable building (manual mapping, not extractVariables, because of flag name mismatches)
5. Calling `runPowerup` with create-powerup's instructions (reuses `getPowerup`, `checkCompiledInstructionsForErrors`, `runPowerup` from `utils/use/`)
6. Capture post-processing (all files via `git ls-files`, or workingDir via `git status`) that generates steps + templates and modifies the new powerup's `index.ts`
7. Registration in local or global config.json
8. Updating the create-powerup's `outputPath` default
9. Updated `createErrors.ts` (add invalid_capture, missing_description, global_root_not_found; remove unused errors)
10. Removal of old `utils/create/` code after new code is working

Key constraints:
- No imports from old `utils/create/` — recreate utilities fresh in new modules
- Reuse `getPowerup`, `checkCompiledInstructionsForErrors`, `runPowerup` from `utils/use/` (imported, not recreated)
- Follow the same coding patterns as `utils/use/` (focused modules, descriptive names, destructured params)
- Test conventions follow `utils/use/` patterns (`#test-utils/test/index`, `setupTestDir()`/`cleanup()`, try/catch + `@ts-expect-error` for sync throws, `throwsAsync` for async throws)
- The `outputPath` passed to `runPowerup` must be relative to `destination` (not absolute)
- For global: `destination` = `GLOBAL_ROOT`, `outputPath` = `installed/_internal`
- For local: `destination` = project root, `outputPath` = `.powerups/installed/_internal`
- `fs.write` adds trailing `\n` — tests must account for this
- Test runner: `proby` — `npx proby <path-to-spec>`

Read the spec file for full details, then create a phased implementation plan with clear steps, file paths, and test expectations for each phase.

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powerups/powerups-oss/.pi-subagents/artifacts/outputs/bdd2b736/plan.md
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