# Task for worker

[Read from: /Users/lioloc/Development/powers/powers_dev/context.md, /Users/lioloc/Development/powers/powers_dev/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement all error file changes from the implementation plan at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-plan.md`.

Read that plan file and focus on **Phase 4: Error Files**.

Also read the design spec at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-design.md` for broader context.

**Files you must modify (read each first to understand current structure):**

1. `packages/cli/src/private/errors/initErrors.ts`:
   - Remove `dry_folder_exists` error
   - Remove `multiple_harnesses_detected` error
   - Add `global_already_initialized`: `"${CLI_NAME} is already initialized globally."`
   - Update `main_folder_not_found` → rename to `global_not_initialized`: `"${CLI_NAME} is not initialized. Run \"${CLI_CMD} init\" first."`
   - Keep `no_harness_detected`, `invalid_harness`, `agents_section_render_failed` unchanged

2. `packages/cli/src/private/errors/updateErrors.ts`:
   - Remove `no_harness_config` error
   - (Do NOT add `no_harnesses_detected` — `detectHarnesses` throws `init_errors.no_harness_detected` which covers this)

3. `packages/cli/src/private/errors/useErrors.ts`:
   - Update `main_folder_not_found` message: change `"${CLI_CMD} init"` → `"${CLI_CMD} project init"`

4. `packages/cli/src/private/errors/addErrors.ts`:
   - Add `project_not_initialized`: `"${MAIN_FOLDER} folder not found. Run \"${CLI_CMD} project init\" first."`

5. `packages/cli/src/private/errors/installErrors.ts`:
   - Add `global_not_initialized`: `"${CLI_NAME} is not initialized globally. Run \"${CLI_CMD} init\" first."`
   - Add `local_not_initialized`: `"${MAIN_FOLDER} folder not found. Run \"${CLI_CMD} project init\" first."`

6. `packages/cli/src/private/errors/infoErrors.ts`:
   - Remove `main_folder_not_found` (info no longer requires local folder)
   - Keep `missing_name` and `not_found` unchanged

7. `packages/cli/src/private/errors/createErrors.ts`:
   - Update `main_folder_not_found` message: change `"${CLI_CMD} init"` → `"${CLI_CMD} project init"`

8. `packages/cli/src/private/errors/doctorErrors.ts`:
   - Read the file. If it has a `not_initialized` error referencing `pup init`, update the message to reference `pup project init` (since doctor checks for local `.powerups` folder).

**New file to create:**
9. `packages/cli/src/private/errors/projectErrors.ts`:
   Follow the exact pattern of other error files (look at `addErrors.ts` or `useErrors.ts` for the template). Include:
   - `project_already_initialized`: `"${CLI_NAME} is already initialized for this project."`
   - `project_not_initialized`: `"${MAIN_FOLDER} folder not found. Run \"${CLI_CMD} project init\" first."`
   - Import `CLI_NAME`, `CLI_CMD`, `MAIN_FOLDER` from `#constants`
   - Export type and code enum following the same pattern as other error files

Read each error file before editing to match the existing code style (error template pattern, coded errors, type exports).

---
Update progress at: /Users/lioloc/Development/powers/powers_dev/.pi-subagents/artifacts/progress/540afc88/progress.md

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