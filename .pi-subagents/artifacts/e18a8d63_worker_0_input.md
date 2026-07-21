# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Task 1: Add New Constants

## Task Description

**Files:**
- Modify: `packages/cli/src/private/constants.ts`

**Step 1: Add new constants to constants.ts**

Add these constants after the existing ones in `packages/cli/src/private/constants.ts`:

```typescript
import { homedir } from "node:os";
import path from "node:path";

/** Subfolder inside .powers/ (or ~/.powers/) holding local packages. */
export const INTERNAL_FOLDER = "internal";

/** Source folder inside a package. */
export const SRC_FOLDER = "src";

/** Name of the package.json file. */
export const PACKAGE_FILE = "package.json";

/** Keyword used in package.json so npm can find powers packages. */
export const KEYWORD_PACKAGE = `${CLI_NAME}-package`;

/** Property name in config.json listing installed packages. */
export const PACKAGES_KEY = "packages";

/** Path to the global powers directory (~/.powers/). */
export const GLOBAL_ROOT = path.join(homedir(), `.${CLI_NAME}`);

/** Path to the global config file (~/.powers/config.json). */
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_ROOT, CONFIG_FILE);

/** Path to the global internal packages folder (~/.powers/internal/). */
export const GLOBAL_INTERNAL_PATH = path.join(GLOBAL_ROOT, INTERNAL_FOLDER);
```

Note: `CLI_NAME` and `CONFIG_FILE` are already defined above in the same file. The imports for `homedir` and `path` go at the top of the file.

**Step 2: Verify the build still compiles**

Run: `cd packages/cli && npx tsgo --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add packages/cli/src/private/constants.ts
git commit -m "feat: add package-related constants (INTERNAL_FOLDER, GLOBAL_ROOT, etc.)"
```

## Context

This is the first task in a package sharing feature for the powers CLI. We're adding constants that will be used throughout the implementation: folder names for the new package-based structure, a keyword for npm search, and paths for the global ~/.powers/ directory.

The existing constants.ts already has `CLI_NAME = "powers"`, `CLI_CMD = "pwrs"`, `CONFIG_FILE = "config.json"`, `MAIN_FOLDER = ".powers"`, `ACTIVE_FOLDER = "active"`, `MULTI_USE_FOLDER = "multi-use"`, `SINGLE_USE_FOLDER = "single-use"`, `TEMPLATE_FOLDER = "template"`.

**IMPORTANT:** Do not hardcode "powers", "pwrs", or "powers-package" — use `CLI_NAME` constant for these derivations.

## Before You Begin

If you have questions about the requirements, ask them now.

## Your Job

1. Implement exactly what the task specifies
2. Verify the build compiles
3. Commit your work
4. Self-review
5. Report back

Work from: .worktrees/package-sharing

## Report Format

When done, report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- What you tested and test results
- Files changed
- Self-review findings (if any)
- Any issues or concerns

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powers/powers_dev/.worktrees/package-sharing/.pi-subagents/artifacts/outputs/e18a8d63/inline
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