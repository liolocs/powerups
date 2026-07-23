# Task for planner

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
Create a detailed implementation plan from the approved design spec at `docs/superpowers/specs/2026-07-23-global-init-harness-removal-design.md`. 

This spec covers reworking the `pup init` / `pup install` / `pup add` / `pup update` command model to mirror pi.dev's philosophy: global initialization by default, with opt-in local project configuration. It also removes the `harness` property from `config.json` in favor of auto-detecting all available agent harnesses at runtime.

Key changes:
1. `pup init` becomes global-only (creates `~/.powerups/` + scaffolds docs to all detected harnesses in home dir)
2. New `pup project init` subcommand (creates local `.powerups/config.json` only, no scaffolding)
3. `pup install` defaults to global, `-l`/`--local` for local install
4. `pup add` requires `pup project init` first (errors instead of silently no-oping)
5. `pup update` always targets global, auto-detects all harnesses, scaffolds to all
6. Remove `harness` from config.json — clean break, no backward compat
7. `detectHarness` → `detectHarnesses` (returns Harness[], global fingerprints only, supports multiple)
8. `scaffold` accepts Harness[] and loops over all
9. `resolvePowerUp` gets `fallbackToGlobal` option for validate/info (merged local+global resolution)
10. `validate` and `info` work from anywhere (remove .powerups requirement)
11. `list` adds global config sources to filter
12. Error handling updates across all commands

The project is a TypeScript monorepo at packages/cli/. Commands are in packages/cli/src/private/commands/. The command auto-discovery is in packages/cli/src/commands/index.ts. Tests use .spec.ts files alongside implementations.

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powers/powers_dev/.pi-subagents/artifacts/outputs/9c07ab0a/plan.md
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