# Task for worker

[Read from: /Users/lioloc/Development/powers/powers_dev/context.md, /Users/lioloc/Development/powers/powers_dev/plan.md]

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Implement the detection and scaffold changes from the implementation plan at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-plan.md`.

Read that plan file and focus on these sections:
- **Phase 2: Detection — detectHarness → detectHarnesses**
- **Phase 3: Scaffold — Multi-Harness Support**
- **Phase 8: CLI Wiring & Misc** (only the `constants.ts` part — adding `HARNESS_FINGERPRINTS`)

Also read the design spec at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-design.md` for broader context.

**Files you must modify:**
1. `packages/cli/src/private/scaffold/detect.ts` — Rename `detectHarness` → `detectHarnesses`. Change return type from `Promise<Harness>` to `Promise<Harness[]>`. Remove `projectRoot` parameter and `options` parameter (no `skipGlobal`). Add optional `options?: { homeDir?: string }` parameter for testability. Remove local fingerprint scanning (the projectRoot.append blocks). Keep global fingerprint scanning only. Add `codex` global fingerprint at `~/.codex`. Use `HARNESS_FINGERPRINTS` from constants. When `--harness` flag is passed, return `[singleHarness]`. When multiple harnesses detected, return all (NO error). When zero detected, throw `init_errors.no_harness_detected()`.
2. `packages/cli/src/private/scaffold/detect.spec.ts` — Rewrite tests for new signature. Tests call `detectHarnesses(flag, { homeDir })` with a temp dir. Test: `--harness` override returns single-element array, invalid harness throws, multiple harnesses detected returns all, zero detected throws `no_harness_detected`. Remove all `multiple_harnesses_detected` tests. Remove all local-dir-based detection tests.
3. `packages/cli/src/private/scaffold/index.ts` — Update `ScaffoldResult` type: `harnesses: Harness[]` (was `harness: Harness`). Update `scaffold` function: first param renamed to `homeDir` (was `projectRoot`), remove `skipGlobal` from options. Call `detectHarnesses(harnessFlag, { homeDir: homeDir.path })`. Loop over all harnesses, writing files to each. Render agents template once, reuse for all harnesses. Return `{ harnesses, filesWritten }`.
4. `packages/cli/src/private/constants.ts` — Add `HARNESS_FINGERPRINTS` map: `{ claude: path.join(homedir(), '.claude'), pi: path.join(homedir(), '.pi/agent'), opencode: path.join(homedir(), '.config/opencode'), codex: path.join(homedir(), '.codex') }`. Import `homedir` from `node:os` and `path` from `node:path`.

**Key interface contracts you must implement exactly (other workers depend on these):**
- `detectHarnesses(harnessFlag: string | undefined, options?: { homeDir?: string }): Promise<Harness[]>` — returns array, never throws for multiple
- `scaffold(homeDir: FileRef, harnessFlag: string | undefined, options?: { rollback?: RollbackInfo }): Promise<{ harnesses: Harness[], filesWritten: string[] }>`
- `HARNESS_FINGERPRINTS: Record<string, string>` exported from constants
- `Harness` type and `VALID_HARNESSES` array stay the same

Read each source file before editing to understand the current implementation.

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