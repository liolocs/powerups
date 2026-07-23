# Task for worker

[Read from: /Users/lioloc/Development/powers/powers_dev/context.md, /Users/lioloc/Development/powers/powers_dev/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the config and resolution changes from the implementation plan at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-plan.md`.

Read that plan file and focus on these sections:
- **Phase 1: Config — Remove harness from Schema & Types**
- **Phase 10: Context homeDir support** (only the parts affecting `config.ts` and `resolve-powerup.ts`)
- **Phase 6: resolvePowerUp — fallbackToGlobal option**

Also read the design spec at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-design.md` for broader context.

**Files you must modify:**
1. `packages/cli/src/private/utils/config.ts` — Remove `harness` from `Config` type, merge `configSchema` and `globalConfigSchema` into one, update `readConfig` (no harness in return), update `readGlobalConfig` to return `Config | null` (instead of always `{ packages: [] }`) AND accept optional `homeDir?: string` parameter for testability, update `writeGlobalConfig` to accept `Config` (no harness), update `addPackageToGlobalConfig` to handle null from `readGlobalConfig` and accept optional `homeDir`
2. `packages/cli/src/private/utils/config.spec.ts` — Remove all `harness` from test fixtures, remove harness-specific test cases, add test for `readGlobalConfig` returning null when file doesn't exist
3. `packages/cli/src/private/utils/resolve-powerup.ts` — Add `fallbackToGlobal?: boolean` and `homeDir?: string` options to `resolvePowerUp`. When `fallbackToGlobal` is true, merge local + global package entries (local priority by source). When neither local nor global config exists and `fallbackToGlobal` is true, throw `power_errors.not_initialized()`. Add import for `readGlobalConfig` and `getPackageSource`.
4. `packages/cli/src/private/utils/resolve-powerup.spec.ts` — Remove `harness` from config fixtures, add tests for `fallbackToGlobal` behavior (resolves from global when no local, merges local+global with local priority, throws not_initialized when neither exists)
5. `packages/cli/src/private/errors/powerErrors.ts` — Add `not_initialized` error: `${CLI_NAME} is not initialized — run "${CLI_CMD} init" first`

**Key interface contracts you must implement exactly (other workers depend on these):**
- `readGlobalConfig(homeDir?: string): Promise<Config | null>` — returns null when file doesn't exist
- `addPackageToGlobalConfig(entry: PackageEntry, homeDir?: string): Promise<void>` — handles null internally
- `resolvePowerUp(root: FileRef, name: string, type?: PowerUpType, options?: { fallbackToGlobal?: boolean; homeDir?: string }): Promise<ResolvedPowerUp>`
- `Config` type: `{ packages: PackageEntry[] }` (NO harness field)
- `power_errors.not_initialized()` — formatted error message

Read each source file before editing to understand the current implementation. Make precise edits, not rewrites.

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