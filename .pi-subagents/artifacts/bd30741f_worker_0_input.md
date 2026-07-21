# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Task 2: Create Package Schema

## Task Description

**Files:**
- Create: `packages/cli/src/private/schemas/package.ts`

**Step 1: Write the package.json schema**

Create `packages/cli/src/private/schemas/package.ts`:

```typescript
import p from "pema";
import { MULTI_USE_FOLDER, SINGLE_USE_FOLDER } from "#constants";

/**
 * Schema for the "powers" property inside a package.json.
 * Maps power names to arrays of instruction.json paths.
 * Top-level powers use their name as the key.
 * Inherited sub-powers use "parent:child" notation.
 */
export const powersPropertySchema = p({
  active: p({
    [MULTI_USE_FOLDER]: p.record(p.string, p.array(p.string)).optional(),
    [SINGLE_USE_FOLDER]: p.record(p.string, p.array(p.string)).optional(),
  }),
});

/**
 * Schema for a package's package.json file.
 */
export const packageJsonSchema = p({
  name: p.string,
  version: p.string,
  description: p.string,
  keywords: p.array(p.string),
  powers: powersPropertySchema,
});

export type PackageJson = (typeof packageJsonSchema)["infer"];
export type PowersProperty = (typeof powersPropertySchema)["infer"];
```

**Step 2: Verify the build compiles**

Run: `cd packages/cli && npx tsgo --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/private/schemas/package.ts
git commit -m "feat: add package.json schema with powers property"
```

## Context

This is Task 2 in a package sharing feature. We're creating a pema schema for package.json files that will be used by the pack commands and the resolution layer. The schema validates that a package.json has the correct `powers` property structure: `active` → `{multi-use, single-use}` → `Record<powerName, instructionPath[]>`.

The project uses `pema` (`p()`) for schema validation, as seen in the existing `packages/cli/src/private/schemas/instruction.ts`. The `#constants` import alias maps to `./src/private/constants.ts` (source) or `./lib/private/constants.js` (built).

The constants `MULTI_USE_FOLDER = "multi-use"` and `SINGLE_USE_FOLDER = "single-use"` are already defined in constants.ts.

## Your Job

1. Create the file exactly as specified
2. Verify the build compiles
3. Commit
4. Self-review and report back

Work from: .worktrees/package-sharing

## Report Format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented, tested, files changed
- Self-review findings

---
**Output:**
Write your findings to exactly this path: /Users/lioloc/Development/powers/powers_dev/.worktrees/package-sharing/.pi-subagents/artifacts/outputs/bd30741f/inline
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