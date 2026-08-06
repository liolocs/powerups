# Include Powerup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `include` step type with an `includePowerup` SDK helper that flattens child steps into the parent at author time and bundles child templates at build time, plus an inline `install` step, a worktree-free atomic runtime engine, and a JSONL manifest with single-use enforcement.

**Architecture:** SDK gains `defineInstructions` + `includePowerup` + a single zod schema (the CLI's duplicate pema schema is deleted). `pup build` compiles the TS entry with tsup (emitting `.d.ts`), runs build-time validation, and copies `_internal` templates from each child's `dist/`. The runtime engine executes flattened steps directly against the project root with `variableMap` resolution, dedup-aware inline `install`, clean-git-state atomicity (pre-flight + targeted revert), and writes `.powerups/manifest.jsonl`.

**Tech Stack:** TypeScript, zod v4 (SDK), pema (CLI — being phased out for the instruction schema), `@rcompat/test` (test framework), `@rcompat/fs` / `@rcompat/io`, tsup, git.

**Spec:** `docs/superpowers/specs/2026-08-06-include-powerup-design.md`

## Resolution model (option B)

The design spec assumed `pup use` reads `<powerupPackageDir>/dist/`, but the
real runtime resolves powerups from a container package's `powerups.active`
map. **Option B** keeps the active map as the registry but abandons the
flattened active-tree copy (`instructions.json` + `template/`) that the old
model maintained. Instead:

- A container's active-map `instructionPath` points at a powerup's built
  entry, e.g. `"test-powerup": "test-powerup/dist/index.js"`.
- `resolvePowerUp` is **unchanged** — it returns `folder = dirname(instructionPath)`,
  which is now the powerup's `dist/` directory.
- `use` sets `outputFolder = resolved.folder` (i.e. `dist/`), reads
  `outputFolder/instructions.json`, and resolves templates from
  `outputFolder/templates/` and `outputFolder/_internal/` — exactly the build
  output. No `templates/` → `template/` rename, no flattened copy step.
- `packageDir = resolved.folder.up(1)` (the powerup package dir, which holds
  `package.json` with the version).

`resolvePowerUp`, `install`, `pack`, `list` keep working as-is; only `use`'s
`outputFolder` computation changes from the plan's earlier (wrong) `+ "/dist"`.

---

## File Structure

### SDK (`packages/sdk`)

- **Modify** `packages/sdk/src/private/schema/instructions.ts` — add `install` step, `variableMap`, `__source`, `from`; remove `include` step, `packageDependencies`, `stepOverrideValueSchema`, `packageDependencyGroup*Schema`; add hand-written `StepOverrideValue` type.
- **Modify** `packages/sdk/src/private/schema/instructions.spec.ts` — cover new fields, removed fields, `install` parsing.
- **Create** `packages/sdk/src/private/include.ts` — `defineInstructions` + `includePowerup`.
- **Create** `packages/sdk/src/private/include.spec.ts` — unit tests for both helpers.
- **Modify** `packages/sdk/src/private/index.ts` — re-export new helpers and `StepOverrideValue`.

### CLI (`packages/cli`)

- **Delete** `packages/cli/src/private/schemas/instruction.ts` (and its spec) — duplicate schema; import from SDK instead.
- **Modify** all files importing `#schemas/instruction` — redirect to `@liolocs/powerups-sdk`.
- **Create** `packages/cli/src/private/utils/git.ts` — `verifyGitRepo` + `ensureCleanTree`.
- **Rewrite** `packages/cli/src/private/utils/execute-steps.ts` — new engine: `RunRecord`, `resolveStepVariables`, `install` handler, no worktrees.
- **Create** `packages/cli/src/private/utils/manifest.ts` — JSONL read/append + single-use check.
- **Create** `packages/cli/src/private/utils/pre-flight.ts` — pre-flight validation pass.
- **Create** `packages/cli/src/private/utils/revert.ts` — targeted revert on failure.
- **Rewrite** `packages/cli/src/private/commands/build/index.ts` — tsup compile, build-time validation, `_internal` bundling.
- **Rewrite** `packages/cli/src/private/commands/use/index.ts` — new flow.
- **Modify** `packages/cli/src/private/errors/buildErrors.ts` — tsup-missing, build-validation errors.
- **Modify** `packages/cli/src/private/errors/useErrors.ts` — add `working_tree_dirty`, `instructions_not_built`, `already_applied`; remove `worktree_*`.
- **Modify** `packages/cli/src/commands/index.ts` — remove `info` + `validate`.
- **Delete** `commands/info/`, `commands/validate/`, `utils/check-output.ts`, `utils/validate-output.ts`, `utils/applied-manifest.ts`, `schemas/applied.ts`, worktree helpers in `worktree.ts`, `collectDependencies`/`applyDependencies`/`detectPackageManager` in `dependencies.ts`.
- **Modify** `packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts` — emit `install` steps.

### Powerups (`.powerups/_internal`)

- **Modify** `cli-command/`, `cli-sub-command/`, `cli-with-sub-command/` — `index.ts` (`defineInstructions` / `includePowerup`) + `package.json`.

---

## Phase A — SDK schema and helpers

> Rationale: everything type-checks against the SDK schema and helpers. Build them first so the rest of the plan compiles.

### Task A1: Update the SDK instruction schema

**Files:**
- Modify: `packages/sdk/src/private/schema/instructions.ts`
- Test: `packages/sdk/src/private/schema/instructions.spec.ts`

- [ ] **Step 1: Write failing tests for new/removed schema behavior**

Append to `packages/sdk/src/private/schema/instructions.spec.ts`:

```typescript
test.case("should parse an install step", async assert => {
  const result = instructionsSchema.parse({
    name: "with-install",
    type: "single-use",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "install",
        name: "deps",
        dependencies: ["lodash@^4.0.0"],
        devDependencies: ["vitest"],
      },
    ],
  });
  assert(result.steps[0].type).equals("install");
  assert((result.steps[0] as any).dependencies).equals(["lodash@^4.0.0"]);
});

test.case("should parse variableMap, __source, and from on a create step", async assert => {
  const result = stepSchema.parse({
    type: "create",
    name: "cmd:comp",
    template: "_internal/cmd/templates/comp.ts",
    outputPath: "src/{{commandName}}.ts",
    variableMap: { commandName: "{{name}}" },
    __source: "file:///x/dist/index.js",
    from: { name: "cmd", singleUse: false },
  });
  assert((result as any).variableMap.commandName).equals("{{name}}");
  assert((result as any).__source).equals("file:///x/dist/index.js");
  assert((result as any).from.singleUse).equals(false);
});

test.case("should reject the include step type", async assert => {
  let threw = false;
  try {
    stepSchema.parse({
      type: "include",
      name: "x",
      variables: {},
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("should reject packageDependencies on instructions", async assert => {
  let threw = false;
  try {
    instructionsSchema.parse({
      name: "x",
      type: "single-use",
      description: "d",
      variables: { required: [] },
      intent: [],
      steps: [],
      packageDependencies: [{ dependencies: ["a"] }],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx proby`
Expected: FAIL — `install` not a known step type, `variableMap`/`__source`/`from` stripped or rejected, `include`/`packageDependencies` still accepted.

- [ ] **Step 3: Rewrite the schema**

Replace the entire contents of `packages/sdk/src/private/schema/instructions.ts` with:

```typescript
import zod from "zod";

const variableMapSchema = zod.record(zod.string(), zod.string()).optional();

const createStepSchema = zod.object({
  type: zod.literal("create"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: zod.object({ name: zod.string(), singleUse: zod.boolean() }).optional(),
});

const modifyStepSchema = zod.object({
  type: zod.literal("modify"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: zod.object({ name: zod.string(), singleUse: zod.boolean() }).optional(),
});

const deleteStepSchema = zod.object({
  type: zod.literal("delete"),
  name: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: zod.object({ name: zod.string(), singleUse: zod.boolean() }).optional(),
});

const readStepSchema = zod.object({
  type: zod.literal("read"),
  name: zod.string(),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: zod.object({ name: zod.string(), singleUse: zod.boolean() }).optional(),
});

const installStepSchema = zod.object({
  type: zod.literal("install"),
  name: zod.string(),
  target: zod.string().optional(),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: zod.object({ name: zod.string(), singleUse: zod.boolean() }).optional(),
});

export const stepSchema = zod.discriminatedUnion("type", [
  createStepSchema,
  modifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  installStepSchema,
]);

export const stepsSchema = zod.array(stepSchema);

export const instructionsSchema = zod.object({
  name: zod.string(),
  type: zod.union([zod.literal("multi-use"), zod.literal("single-use")]),
  description: zod.string(),
  variables: zod.object({
    required: zod.array(zod.string()),
    optional: zod.array(zod.string()).optional(),
  }),
  intent: zod.array(zod.string()),
  steps: stepsSchema,
});

// Hand-written (stepOverrideValueSchema was deleted; the type is still needed
// by includePowerup). Mirrors the step shapes minus `name`, with an install variant.
export type StepOverrideValue =
  | { type: "create"; template: string; outputPath: string }
  | { type: "modify"; template: string; outputPath: string }
  | { type: "delete"; outputPath: string }
  | { type: "read"; path: string; as: string; jsonPath?: string; template?: string }
  | {
      type: "install";
      target?: string;
      dependencies?: string[];
      devDependencies?: string[];
      peerDependencies?: string[];
    };

export type Step = zod.infer<typeof stepSchema>;
export type Instructions = zod.infer<typeof instructionsSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk && npx proby`
Expected: PASS — all new cases green, existing create/modify/delete/read cases still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/private/schema/instructions.ts packages/sdk/src/private/schema/instructions.spec.ts
git commit -m "feat(sdk): update instruction schema for include powerup design"
```

### Task A2: Add `defineInstructions` and `includePowerup` helpers

**Files:**
- Create: `packages/sdk/src/private/include.ts`
- Test: `packages/sdk/src/private/include.spec.ts`

- [ ] **Step 1: Write failing tests for the helpers**

Create `packages/sdk/src/private/include.spec.ts`:

```typescript
import test from "@rcompat/test";
import { defineInstructions, includePowerup } from "#include";
import type { Instructions } from "#schema/instructions";

const childInstructions: Instructions = {
  name: "child",
  type: "multi-use",
  description: "child",
  variables: { required: ["commandName"], optional: ["flags"] },
  intent: [],
  steps: [
    {
      type: "create",
      name: "command",
      template: "templates/command.ts",
      outputPath: "src/{{commandName}}.ts",
    },
    {
      type: "create",
      name: "spec",
      template: "templates/spec.ts",
      outputPath: "src/{{commandName}}.spec.ts",
    },
  ],
};

test.case("defineInstructions wraps instructions and source", async assert => {
  const out = defineInstructions(childInstructions, "file:///child/dist/index.js");
  assert(out.instructions).defined();
  assert(out.source).equals("file:///child/dist/index.js");
});

test.case("includePowerup prefixes templates, renames steps, attaches maps", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}", flags: "[]" },
  });
  assert(steps.length).equals(2);
  assert(steps[0].name).equals("child:command");
  assert((steps[0] as any).template).equals("_internal/child/templates/command.ts");
  assert((steps[0] as any).variableMap.commandName).equals("{{name}}");
  assert((steps[0] as any).__source).equals("file:///child/dist/index.js");
  assert((steps[0] as any).from.name).equals("child");
  assert((steps[0] as any).from.singleUse).equals(false);
});

test.case("includePowerup honors excludeSteps", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}" },
    excludeSteps: ["spec"],
  });
  assert(steps.length).equals(1);
  assert(steps[0].name).equals("child:command");
});

test.case("includePowerup applies stepOverride", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    variables: { commandName: "{{name}}" },
    stepOverride: {
      command: { type: "create", template: "templates/other.ts", outputPath: "src/{{commandName}}.ts" },
    },
  });
  assert((steps[0] as any).template).equals("_internal/child/templates/other.ts");
});

test.case("includePowerup uses explicit namespace", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    namespace: "alias",
    variables: { commandName: "{{name}}" },
  });
  assert(steps[0].name).equals("alias:command");
  assert((steps[0] as any).template).equals("_internal/alias/templates/command.ts");
});

test.case("includePowerup composes variableMap for transitive includes", async assert => {
  // simulate a step that already carries a variableMap (as a transitive child would)
  const transitiveInstructions: Instructions = {
    name: "grand",
    type: "multi-use",
    description: "grand",
    variables: { required: ["grandName"] },
    intent: [],
    steps: [
      {
        type: "create",
        name: "g",
        template: "_internal/grand/templates/g.ts",
        outputPath: "src/{{grandName}}.ts",
        variableMap: { grandName: "{{commandName}}" },
        __source: "file:///grand/dist/index.js",
        from: { name: "grand", singleUse: false },
      },
    ],
  };
  const child = defineInstructions(transitiveInstructions, "file:///child/dist/index.js");
  const steps = includePowerup(child, {
    namespace: "child",
    variables: { commandName: "{{name}}" },
  });
  // parent map first, child's existing map second
  const map = (steps[0] as any).variableMap;
  assert(Object.keys(map)[0]).equals("commandName");
  assert(Object.keys(map)[1]).equals("grandName");
  assert(map.grandName).equals("{{commandName}}");
  // transitive template already starts with _internal/ — not re-prefixed
  assert((steps[0] as any).template).equals("_internal/grand/templates/g.ts");
  // __source retained from the grandchild step
  assert((steps[0] as any).__source).equals("file:///grand/dist/index.js");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx proby`
Expected: FAIL — `#include` not found.

- [ ] **Step 3: Implement the helpers**

Create `packages/sdk/src/private/include.ts`:

```typescript
import type { Instructions, Step, StepOverrideValue } from "#schema/instructions";

export function defineInstructions<const I extends Instructions>(
  instructions: I,
  source: string,
): { instructions: I; source: string } {
  return { instructions, source };
}

function isInternalTemplate(template: string): boolean {
  return template.startsWith("_internal/");
}

function prefixTemplate(template: string, namespace: string): string {
  return isInternalTemplate(template) ? template : `_internal/${namespace}/${template}`;
}

function applyOverride(step: Step, override: StepOverrideValue): Step {
  // override carries every field except `name` and `type` (type must match)
  return { ...override, name: step.name, type: step.type } as unknown as Step;
}

export function includePowerup<const I extends Instructions>(
  child: { instructions: I; source: string },
  options: {
    variables: { [K in I["variables"]["required"][number]]: string } & {
      [K in NonNullable<I["variables"]["optional"]>[number]]?: string;
    };
    excludeSteps?: I["steps"][number]["name"][];
    stepOverride?: Record<string, StepOverrideValue>;
    namespace?: string;
  },
): Step[] {
  const namespace = options.namespace ?? child.instructions.name;
  const exclude = new Set<string>((options.excludeSteps ?? []) as string[]);
  const overrides = options.stepOverride ?? {};
  const singleUse = child.instructions.type === "single-use";

  return child.instructions.steps
    .filter(step => !exclude.has(step.name))
    .map(step => {
      const overridden = overrides[step.name] ? applyOverride(step, overrides[step.name]) : step;

      // compose: parent map first (resolves against parent scope), child's existing
      // map last (transitive — may reference parent-mapped names). Sequential
      // resolution in object-key order makes the chain work at runtime.
      const existingMap = (overridden as Step & { variableMap?: Record<string, string> }).variableMap;
      const composedMap: Record<string, string> = { ...(options.variables as Record<string, string>), ...(existingMap ?? {}) };

      const templateField = (overridden as Step & { template?: string }).template;
      const renamed = { ...overridden, name: `${namespace}:${overridden.name}` } as Step & { template?: string };

      if (templateField !== undefined) {
        renamed.template = prefixTemplate(templateField, namespace);
      }

      const withMap = { ...renamed, variableMap: composedMap, __source: child.source, from: { name: child.instructions.name, singleUse } };

      return withMap as unknown as Step;
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk && npx proby`
Expected: PASS — all include.spec cases green.

- [ ] **Step 5: Export the new helpers from the SDK**

Modify `packages/sdk/src/private/index.ts` to:

```typescript
export { powerupPropertySchema, type PowerupProperty } from "#schema/powerup";
export {
  instructionsSchema,
  type Instructions,
  type Step,
  type StepOverrideValue,
} from "#schema/instructions";
export { defineInstructions, includePowerup } from "#include";
```

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/private/include.ts packages/sdk/src/private/include.spec.ts packages/sdk/src/private/index.ts
git commit -m "feat(sdk): add defineInstructions and includePowerup helpers"
```

### Task A3: Type-check the parent example against the SDK

This is a verification-only task — no new files. It confirms the `const`-generic typing works end-to-end before the CLI consumes it.

- [ ] **Step 1: Temporarily add a parent-style usage test**

Append to `packages/sdk/src/private/include.spec.ts`:

```typescript
test.case("includePowerup rejects unknown required variables at compile time", async assert => {
  const child = defineInstructions(childInstructions, "file:///child/dist/index.js");
  // @ts-expect-error — missing required "commandName"
  const _steps = includePowerup(child, { variables: {} });
  assert(true).true();
});
```

- [ ] **Step 2: Run type-check + tests**

Run: `cd packages/sdk && npx tsgo && npx proby`
Expected: PASS — the `@ts-expect-error` is satisfied (the line errors as expected), tests pass.

- [ ] **Step 3: Remove the temporary test and commit**

Delete the test case added in Step 1. Then:

```bash
git add packages/sdk/src/private/include.spec.ts
git commit -m "chore(sdk): verify includePowerup compile-time type safety"
```

---

## Phase B — CLI schema consolidation

> Delete the CLI's duplicate pema instruction schema; everything imports the SDK's zod schema now.

### Task B1: Delete the CLI duplicate schema and redirect imports

**Files:**
- Delete: `packages/cli/src/private/schemas/instruction.ts`, `packages/cli/src/private/schemas/instruction.spec.ts`
- Modify: every file importing `#schemas/instruction`

- [ ] **Step 1: Find all importers**

Run: `grep -rln "#schemas/instruction" packages/cli/src`
Expected output (the exact set to update):
```
packages/cli/src/private/utils/move/collect.ts
packages/cli/src/private/utils/dependencies.ts
packages/cli/src/private/utils/check-output.ts
packages/cli/src/private/utils/validate-output.ts
packages/cli/src/private/utils/create/create-powerup.ts
packages/cli/src/private/utils/create/get-package-deps.ts
packages/cli/src/private/utils/create/steps/create-step-from-new-file.ts
packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts
packages/cli/src/private/utils/create/steps/create-step-from-deleted-file.ts
packages/cli/src/private/utils/create/steps/index.ts
packages/cli/src/private/utils/create/steps/create-step-from-modified-file.ts
packages/cli/src/private/utils/execute-steps.ts
packages/cli/src/private/commands/validate/index.ts
packages/cli/src/private/commands/doctor/index.ts
packages/cli/src/private/commands/info/index.ts
packages/cli/src/private/commands/use/index.ts
packages/cli/src/private/commands/find/index.ts
packages/cli/src/private/commands/build/index.ts
```

- [ ] **Step 2: Delete the duplicate schema**

```bash
git rm packages/cli/src/private/schemas/instruction.ts packages/cli/src/private/schemas/instruction.spec.ts
```

- [ ] **Step 3: Redirect imports in each importer**

For each file listed in Step 1, replace:

```typescript
import { instructionsSchema, ... } from "#schemas/instruction";
```

with:

```typescript
import { instructionsSchema, ... } from "@liolocs/powerups-sdk";
```

Carry over only the symbols that file actually imports (`instructionsSchema`, `type Step`, `type Instructions`, `type StepOverrideValue` as needed). Several of these files are deleted later in the plan (info/validate/check-output/validate-output/dependencies) — redirect them anyway for now so the tree compiles before deletion; it keeps each commit green.

> Note: `@liolocs/powerups-sdk` is already a `devDependency` of the CLI (`packages/cli/package.json`), and the CLI's `imports` map exposes it under `@powerups/source`, so the redirect resolves in both source and built modes.

- [ ] **Step 4: Verify the CLI compiles and tests still run**

Run: `cd packages/cli && npx tsgo && npx proby`
Expected: PASS (existing tests; several will be deleted later — that's fine).

- [ ] **Step 5: Commit**

```bash
git add -A packages/cli/src
git commit -m "refactor(cli): use SDK instruction schema, delete duplicate pema schema"
```

---

## Phase C — CLI build command overhaul

### Task C1: Add build errors for the new build flow

**Files:**
- Modify: `packages/cli/src/private/errors/buildErrors.ts`

- [ ] **Step 1: Add the new error codes**

In `packages/cli/src/private/errors/buildErrors.ts`, add these entries inside the `build_errors` object (before the closing `}`):

```typescript
  tsup_not_installed: () => {
    const errorText =
      `pup build requires tsup — add it as a devDependency of this powerup package.\n` +
      `Run: npm i -D tsup (or pnpm add -D tsup)`;
    return t`${errorBGText}${errorText}`;
  },

  build_validation_failed: (issues: string[]) => {
    const issueList = issues.map(i => `  - ${i}`).join("\n");
    const errorText = `Build validation failed:\n${issueList}`;
    return t`${errorBGText}${errorText}`;
  },

  child_not_built: (childName: string) => {
    const errorText =
      `Included powerup "${childName}" has no dist/ — build it first.\n` +
      `Run "pup build" in the ${childName} package, then rebuild the parent.`;
    return t`${errorBGText}${errorText}`;
  },
```

Also update `invalid_instructions_file` to reflect the new export shape:

```typescript
  invalid_instructions_file: (fileName: string) => {
    const errorText =
      `Invalid instructions file: ${fileName}\n` +
      `Must default-export the result of defineInstructions(...).`;
    return t`${errorBGText}${errorText}`;
  },
```

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/private/errors/buildErrors.ts
git commit -m "feat(cli): add build errors for tsup compilation and validation"
```

### Task C2: Lazy tsup resolver

**Files:**
- Create: `packages/cli/src/private/utils/tsup-resolver.ts`
- Test: `packages/cli/src/private/utils/tsup-resolver.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/tsup-resolver.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolveTsup } from "#utils/tsup-resolver";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-tsup-tmp");

test.case("throws tsup_not_installed when tsup is absent", async assert => {
  const dir = tmpBase.append("/no-tsup");
  await fs.create(dir);
  await dir.append("/package.json").write("{}");
  let threw = false;
  try {
    await resolveTsup(dir);
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("tsup_not_installed");
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the resolver**

Create `packages/cli/src/private/utils/tsup-resolver.ts`:

```typescript
import { createRequire } from "node:module";
import type { FileRef } from "@rcompat/fs";
import build_errors from "#errors/buildErrors";

/**
 * Lazily resolve tsup from the powerup project being built (its node_modules),
 * not from the CLI's own dependencies. Throws build_errors.tsup_not_installed
 * with a friendly message if tsup is not installed in the target project.
 */
export async function resolveTsup(cwd: FileRef): Promise<typeof import("tsup")> {
  const packageJsonPath = cwd.append("/package.json").path;
  const projectRequire = createRequire(packageJsonPath);
  try {
    return projectRequire("tsup") as typeof import("tsup");
  } catch {
    throw build_errors.tsup_not_installed();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/tsup-resolver.ts packages/cli/src/private/utils/tsup-resolver.spec.ts
git commit -m "feat(cli): add lazy tsup resolver from target project"
```

### Task C3: Build-time validation

**Files:**
- Create: `packages/cli/src/private/utils/build-validation.ts`
- Test: `packages/cli/src/private/utils/build-validation.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/build-validation.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validateInstructions } from "#utils/build-validation";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-build-val-tmp");

function baseInstructions(steps: any[]): Instructions {
  return {
    name: "p",
    type: "multi-use",
    description: "d",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps,
  };
}

test.case("passes for valid flattened instructions", async assert => {
  const dir = tmpBase.append("/ok");
  await fs.create(dir);
  await dir.append("/templates").directory.create();
  await dir.append("/templates/a.ts").write("export default () => '';");
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" },
      { type: "create", name: "child:b", template: "_internal/child/templates/b.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } },
    ]),
    { outputFolder: dir, ownNamespaces: new Set(["child"]) },
  );
  // _internal/child template existence is checked at copy time, not here;
  // this validator only checks own templates. So this passes.
  assert(issues.length).equals(0);
  await dir.remove({ recursive: true });
});

test.case("flags duplicate step names", async assert => {
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "x" },
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "y" },
    ]),
    { outputFolder: tmpBase, ownNamespaces: new Set() },
  );
  assert(issues.some(i => i.includes("duplicate step name: a"))).true();
});

test.case("flags missing own template", async assert => {
  const dir = tmpBase.append("/missing");
  await fs.create(dir);
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "a", template: "templates/missing.ts", outputPath: "x" },
    ]),
    { outputFolder: dir, ownNamespaces: new Set() },
  );
  assert(issues.some(i => i.includes("missing template file: templates/missing.ts"))).true();
  await dir.remove({ recursive: true });
});

test.case("flags unknown variable in outputPath", async assert => {
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{unknown}}.ts" },
    ]),
    { outputFolder: tmpBase, ownNamespaces: new Set() },
  );
  assert(issues.some(i => i.includes("uses {{unknown}} before it is available"))).true();
});

test.case("allows variableMap keys as available within their step", async assert => {
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" } },
    ]),
    { outputFolder: tmpBase, ownNamespaces: new Set() },
  );
  assert(issues.length).equals(0);
});

test.case("flags namespace collision", async assert => {
  const issues = await validateInstructions(
    baseInstructions([
      { type: "create", name: "child:a", template: "_internal/child/templates/a.ts", outputPath: "x", variableMap: { x: "{{name}}" } },
      { type: "create", name: "child:b", template: "_internal/child/templates/b.ts", outputPath: "y", variableMap: { x: "{{name}}" } },
    ]),
    { outputFolder: tmpBase, ownNamespaces: new Set() },
  );
  // two steps sharing the same _internal/child namespace from different inclusions
  // is fine if they came from the SAME include (same __source). Collision is
  // detected at the build-orchestration level (ownNamespaces passed by caller).
  // Here the caller declares "child" already used elsewhere → flag.
  assert(issues.some(i => i.includes("namespace collision: child"))).true();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement build-validation**

Create `packages/cli/src/private/utils/build-validation.ts`:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import type { Instructions, Step } from "@liolocs/powerups-sdk";

export interface BuildValidationContext {
  /** The powerup's own dist/ folder — used to verify own templates exist. */
  outputFolder: FileRef;
  /** Namespaces already claimed by earlier inclusions in this build (collision check). */
  ownNamespaces: Set<string>;
}

const TOKEN = /\{\{(\w+)\}\}/g;

function templateOf(step: Step): string | undefined {
  return (step as Step & { template?: string }).template;
}

function pathOf(step: Step): string | undefined {
  if (step.type === "create" || step.type === "modify" || step.type === "delete") {
    return step.outputPath;
  }
  if (step.type === "read") {
    return step.path;
  }
  return undefined;
}

function mapKeys(step: Step): Set<string> {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  return new Set(map ? Object.keys(map) : []);
}

/**
 * Build-time validation replacing the deleted runtime checkOutput.
 * Returns a list of issue strings (empty = valid).
 */
export async function validateInstructions(
  instructions: Instructions,
  ctx: BuildValidationContext,
): Promise<string[]> {
  const issues: string[] = [];
  const required = instructions.variables.required;
  const optional = instructions.variables.optional ?? [];
  const declared = new Set<string>([
    ...required.map(r => r.toLowerCase()),
    ...optional.map(o => o.toLowerCase()),
  ]);

  // unique step names + namespace collisions
  const seen = new Set<string>();
  const claimedNamespaces = new Set<string>(ctx.ownNamespaces);

  for (const step of instructions.steps) {
    if (seen.has(step.name)) {
      issues.push(`duplicate step name: ${step.name}`);
    }
    seen.add(step.name);

    const tmpl = templateOf(step);
    if (tmpl && tmpl.startsWith("_internal/")) {
      const ns = tmpl.split("/")[1];
      if (claimedNamespaces.has(ns) && !ctx.ownNamespaces.has(ns)) {
        // already claimed by a prior include in this same build
        issues.push(`namespace collision: ${ns}`);
      }
      claimedNamespaces.add(ns);
    }
  }

  // template existence (own templates only — _internal resolved at copy time)
  for (const step of instructions.steps) {
    const tmpl = templateOf(step);
    if (tmpl && !tmpl.startsWith("_internal/")) {
      const ref = ctx.outputFolder.append(`/${tmpl}`);
      if (!(await fs.exists(ref))) {
        issues.push(`missing template file: ${tmpl}`);
      }
    }
  }

  // variable availability (read-produced vars accumulate in order)
  const available = new Set<string>(declared);
  for (const step of instructions.steps) {
    const p = pathOf(step);
    const keys = mapKeys(step);
    if (p) {
      for (const [, token] of p.matchAll(TOKEN)) {
        if (!available.has(token.toLowerCase()) && !keys.has(token)) {
          issues.push(`step "${step.name}" uses {{${token}}} before it is available`);
        }
      }
    }
    if (step.type === "read") {
      available.add(step.as.toLowerCase());
    }
  }

  return issues;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/build-validation.ts packages/cli/src/private/utils/build-validation.spec.ts
git commit -m "feat(cli): add build-time instruction validation"
```

### Task C4: Rewrite the build command

**Files:**
- Rewrite: `packages/cli/src/private/commands/build/index.ts`
- Test: `packages/cli/src/private/commands/build/build.spec.ts`

- [ ] **Step 1: Update the existing build tests for the new export format**

In `packages/cli/src/private/commands/build/build.spec.ts`, replace `validInstructionsTs` with a `defineInstructions` export. The compiled JS must be importable, so the test project needs the SDK resolvable. Update `validInstructionsTs` to:

```typescript
const validInstructionsTs =
  `import { defineInstructions } from "@liolocs/powerups-sdk";\n` +
  `export default defineInstructions({\n` +
  `  name: "test-powerup",\n` +
  `  type: "single-use",\n` +
  `  description: "A test powerup",\n` +
  `  variables: { required: [] },\n` +
  `  intent: [],\n` +
  `  steps: [\n` +
  `    { type: "create", name: "comp", template: "template/comp.ts.ts", outputPath: "src/comp.ts" },\n` +
  `  ],\n` +
  `}, import.meta.url);\n`;
```

And the test's `setupPowerup` must also symlink/copy the SDK into the temp project's `node_modules` so `tsup`-compiled output can resolve `@liolocs/powerups-sdk` at build-import time. Add to `setupPowerup` (after writing files):

```typescript
  // make the SDK resolvable from the temp powerup
  const nm = tmpDir.append("/node_modules/@liolocs");
  await nm.directory.create();
  await fs.ref(root.append("/packages/sdk").path).link(nm.append("/powerups-sdk").path);
```

(Adjust the existing assertions: build now produces `dist/index.js`, `dist/index.d.ts`, `dist/instructions.json`, `dist/template/comp.ts.ts`.)

- [ ] **Step 2: Run to verify build tests fail**

Run: `cd packages/cli && npx proby`
Expected: FAIL — build still expects the old function export and doesn't compile with tsup.

- [ ] **Step 3: Rewrite the build command**

Replace the entire contents of `packages/cli/src/private/commands/build/index.ts` with:

```typescript
import { createRequire } from "node:module";
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import { powerupPropertySchema, instructionsSchema, type Instructions, type Step } from "@liolocs/powerups-sdk";
import build_errors from "#errors/buildErrors";
import { validateInstructions } from "#utils/build-validation";
import { resolveTsup } from "#utils/tsup-resolver";
import { SINGULAR_NAME, PACKAGE_FILE, KEYWORD_PACKAGE } from "#constants";

function fileUrlToDir(sourceUrl: string): FileRef {
  // sourceUrl is import.meta.url of a dist/index.js — walk up to the package root
  const path = sourceUrl.startsWith("file://") ? sourceUrl.slice(7) : sourceUrl;
  return fs.ref(path).directory;
}

async function resolvePackageDir(sourceUrl: string): Promise<FileRef> {
  let dir = fileUrlToDir(sourceUrl);
  for (let i = 0; i < 20; i++) {
    if (await fs.exists(dir.append(`/${PACKAGE_FILE}`))) {
      return dir;
    }
    dir = dir.up(1);
  }
  throw new Error(`Could not resolve package directory from ${sourceUrl}`);
}

function stripSource(steps: Step[]): Step[] {
  return steps.map(step => {
    const { __source: _omit, ...rest } = step as Step & { __source?: string };
    return rest as Step;
  });
}

export async function buildPowerup(cwd: FileRef): Promise<void> {
  const packageJsonRef = cwd.append(`/${PACKAGE_FILE}`);
  if (!(await packageJsonRef.exists())) {
    throw build_errors.no_package_json();
  }

  const pkgJson = await packageJsonRef.json() as Record<string, unknown>;
  const keywords = pkgJson.keywords;
  if (!Array.isArray(keywords) || !keywords.includes(KEYWORD_PACKAGE)) {
    throw build_errors.not_a_powerups_package();
  }

  const powerupResult = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME]);
  if (!powerupResult.success) {
    throw build_errors.malformed_powerup_property(powerupResult.error.message);
  }

  const entryPath = powerupResult.data.instructions;
  const distRef = cwd.append("/dist");
  const distIndex = distRef.append("/index.js");

  // 1. Compile with tsup (dts: true, ESM, external imports)
  const tsup = await resolveTsup(cwd);
  if (await distRef.exists()) {
    await distRef.remove({ recursive: true });
  }
  await distRef.create();

  await tsup.build({
    entry: [entryPath],
    outDir: "dist",
    format: ["esm"],
    dts: true,
    external: [/^(?!^[./])/], // keep all bare imports external
    splitting: false,
    clean: false,
    silent: true,
  });

  if (!(await fs.exists(distIndex))) {
    throw build_errors.invalid_instructions_file(entryPath);
  }

  // 2. Import compiled dist/index.js → { instructions, source }
  const moduleUrl = distIndex.path;
  const compiled = await import(moduleUrl);
  if (
    !compiled.default ||
    typeof compiled.default !== "object" ||
    !compiled.default.instructions
  ) {
    throw build_errors.invalid_instructions_file(entryPath);
  }
  const { instructions, source } = compiled.default as { instructions: Instructions; source: string };

  // 3. Validate schema
  const schemaResult = instructionsSchema.safeParse(instructions);
  if (!schemaResult.success) {
    throw build_errors.malformed_instructions(schemaResult.error.message);
  }
  const validated = schemaResult.data;

  // 4. Build-time validation
  const ownNamespaces = new Set<string>();
  const validationIssues = await validateInstructions(validated, {
    outputFolder: distRef,
    ownNamespaces,
  });
  if (validationIssues.length > 0) {
    throw build_errors.build_validation_failed(validationIssues);
  }

  // 5. Write instructions.json (strip __source)
  const serializable = { ...validated, steps: stripSource(validated.steps) };
  await distRef.append("/instructions.json").writeJSON(serializable);

  // 6. Copy own templates
  for (const step of validated.steps) {
    const tmpl = (step as Step & { template?: string }).template;
    if (!tmpl || tmpl.startsWith("_internal/")) continue;
    const src = cwd.append(`/${tmpl}`);
    if (!(await fs.exists(src))) {
      throw build_errors.template_not_found(tmpl);
    }
    const dest = distRef.append(`/${tmpl}`);
    await dest.directory.create();
    await src.copy(dest);
  }

  // 7. Copy _internal templates from each step's __source package dist/
  const copied = new Set<string>();
  for (const step of validated.steps) {
    const tmpl = (step as Step & { template?: string }).template;
    if (!tmpl || !tmpl.startsWith("_internal/")) continue;
    if (copied.has(tmpl)) continue;
    copied.add(tmpl);

    const __source = (step as Step & { __source?: string }).__source ?? source;
    const pkgDir = await resolvePackageDir(__source);
    // subpath after _internal/<namespace>/
    const subpath = tmpl.split("/").slice(2).join("/");
    const src = pkgDir.append(`/dist/${subpath}`);
    if (!(await fs.exists(src))) {
      throw build_errors.child_not_built(tmpl.split("/")[1]);
    }
    const dest = distRef.append(`/${tmpl}`);
    await dest.directory.create();
    await src.copy(dest);
  }

  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const name = typeof pkgJson.name === "string" ? pkgJson.name : SINGULAR_NAME;
  cli.print(`${green("✓")} Built ${SINGULAR_NAME}: ${name}\n`);
  cli.print(`  ${dim("output:")} ${distRef.path}\n`);
}

const build = new Command({
  name: "build",
  description: `Build a ${SINGULAR_NAME} for distribution`,
  flags: [],
  subcommands: [],
  action: async () => {
    await buildPowerup(runtime.cwd());
  },
});

export default build;
```

- [ ] **Step 4: Run build tests to verify they pass**

Run: `cd packages/cli && npx proby`
Expected: PASS — build produces `dist/index.js`, `dist/index.d.ts`, `dist/instructions.json`, and copied own template.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/commands/build/index.ts packages/cli/src/private/commands/build/build.spec.ts
git commit -m "feat(cli): rewrite build command with tsup compilation and _internal bundling"
```

---

## Phase D — CLI runtime engine

### Task D1: git utilities (verifyGitRepo + ensureCleanTree)

**Files:**
- Create: `packages/cli/src/private/utils/git.ts`
- Test: `packages/cli/src/private/utils/git.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/git.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { verifyGitRepo, ensureCleanTree } from "#utils/git";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-git-tmp");

async function freshRepo(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await io.run("git init", { cwd: dir.path });
  await io.run('git config user.email t@t.tt && git config user.name t', { cwd: dir.path });
  await dir.append("/a.txt").write("a");
  await io.run("git add . && git commit -m init", { cwd: dir.path });
  return dir;
}

test.case("verifyGitRepo passes in a repo", async assert => {
  const dir = await freshRepo();
  await verifyGitRepo(dir);
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("ensureCleanTree passes when clean", async assert => {
  const dir = await freshRepo();
  await ensureCleanTree(dir);
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("ensureCleanTree throws when there are uncommitted changes", async assert => {
  const dir = await freshRepo();
  await dir.append("/a.txt").write("dirty");
  let threw = false;
  try {
    await ensureCleanTree(dir);
  } catch {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement git utilities**

Create `packages/cli/src/private/utils/git.ts`:

```typescript
import type { FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import use_errors from "#errors/useErrors";

export async function verifyGitRepo(projectRoot: FileRef): Promise<void> {
  try {
    await io.run("git rev-parse --git-dir", { cwd: projectRoot.path });
  } catch {
    throw use_errors.git_repo_required();
  }
}

/**
 * Require an empty working tree so a failed run can be reverted via
 * `git checkout --`. Returns nothing; throws use_errors.working_tree_dirty
 * if `git status --porcelain` produces any output.
 */
export async function ensureCleanTree(projectRoot: FileRef): Promise<void> {
  let status: string;
  try {
    status = await io.run("git status --porcelain", { cwd: projectRoot.path });
  } catch {
    throw use_errors.git_repo_required();
  }
  if (status.trim().length > 0) {
    throw use_errors.working_tree_dirty();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/git.ts packages/cli/src/private/utils/git.spec.ts
git commit -m "feat(cli): add git utilities for clean-state atomicity"
```

### Task D2: Add the `working_tree_dirty` and `instructions_not_built` use errors

**Files:**
- Modify: `packages/cli/src/private/errors/useErrors.ts`

- [ ] **Step 1: Add the new error codes and remove obsolete ones**

In `packages/cli/src/private/errors/useErrors.ts`:

Add after `git_repo_required`:

```typescript
  working_tree_dirty: () => {
    const errorText =
      "Working tree is not clean. Commit or stash your changes before running pup use.";
    return t`${errorBGText}${errorText}`;
  },

  instructions_not_built: (name: string) => {
    const errorText =
      `No built instructions for ${name}. Run "pup build" in the powerup package first.`;
    return t`${errorBGText}${errorText}`;
  },

  already_applied: (name: string) => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} ${name} is single-use and has already been applied.`;
    return t`${errorBGText}${errorText}`;
  },
```

Remove the `worktree_creation_failed` and `worktree_apply_failed` entries (no longer used).

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/private/errors/useErrors.ts
git commit -m "feat(cli): add working_tree_dirty, instructions_not_built, already_applied errors"
```

### Task D3: Manifest (JSONL read/append + single-use check)

**Files:**
- Create: `packages/cli/src/private/utils/manifest.ts`
- Test: `packages/cli/src/private/utils/manifest.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/private/utils/manifest.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { readManifest, appendManifestEntry, hasBeenApplied, ManifestEntry } from "#utils/manifest";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-manifest-tmp");

async function freshProject(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await dir.append("/.powerups").directory.create();
  return dir;
}

const entry = (name: string, type: "multi-use" | "single-use" = "multi-use"): ManifestEntry => ({
  powerup: name,
  package: name,
  version: "1.0.0",
  location: "local",
  type,
  timestamp: new Date().toISOString(),
  variables: {},
  steps: [],
  files: [],
});

test.case("readManifest returns empty for missing file", async assert => {
  const dir = await freshProject();
  const m = await readManifest(dir);
  assert(m.length).equals(0);
  await dir.remove({ recursive: true });
});

test.case("appendManifestEntry then readManifest round-trips", async assert => {
  const dir = await freshProject();
  await appendManifestEntry(dir, entry("foo"));
  const m = await readManifest(dir);
  assert(m.length).equals(1);
  assert(m[0].powerup).equals("foo");
  await dir.remove({ recursive: true });
});

test.case("hasBeenApplied matches by powerup name", async assert => {
  const dir = await freshProject();
  await appendManifestEntry(dir, entry("foo", "single-use"));
  assert(await hasBeenApplied(dir, "foo")).true();
  assert(await hasBeenApplied(dir, "bar")).false();
  await dir.remove({ recursive: true });
});

test.case("readManifest skips unparseable lines with a warning", async assert => {
  const dir = await freshProject();
  const ref = dir.append("/.powerups/manifest.jsonl");
  await ref.write("not json\n");
  await appendManifestEntry(dir, entry("ok"));
  const m = await readManifest(dir);
  assert(m.length).equals(1);
  assert(m[0].powerup).equals("ok");
  await dir.remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the manifest module**

Create `packages/cli/src/private/utils/manifest.ts`:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { MAIN_FOLDER } from "#constants";

const MANIFEST_FILE = "manifest.jsonl";

export interface ManifestEntry {
  powerup: string;
  package: string;
  version: string;
  location: "local" | "global";
  type: "multi-use" | "single-use";
  timestamp: string;
  variables: Record<string, string>;
  steps: { name: string; type: string; status: "applied" | "skipped-warning" | "skipped-already-applied"; from?: string }[];
  files: { path: string; action: "create" | "modify" | "delete" }[];
}

function manifestRef(root: FileRef): FileRef {
  return root.append(`/${MAIN_FOLDER}/${MANIFEST_FILE}`);
}

export async function readManifest(root: FileRef): Promise<ManifestEntry[]> {
  const ref = manifestRef(root);
  if (!(await fs.exists(ref))) {
    return [];
  }
  const text = await ref.text();
  const entries: ManifestEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      entries.push(JSON.parse(trimmed) as ManifestEntry);
    } catch {
      cli.print(`Warning: skipping unparseable manifest line\n`);
    }
  }
  return entries;
}

export async function appendManifestEntry(root: FileRef, entry: ManifestEntry): Promise<void> {
  const ref = manifestRef(root);
  await fs.create(ref.directory);
  const line = JSON.stringify(entry) + "\n";
  const existing = await fs.exists(ref) ? await ref.text() : "";
  await ref.write(existing + line);
}

export async function hasBeenApplied(root: FileRef, powerupName: string): Promise<boolean> {
  const entries = await readManifest(root);
  return entries.some(e => e.powerup === powerupName);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/manifest.ts packages/cli/src/private/utils/manifest.spec.ts
git commit -m "feat(cli): add JSONL manifest with single-use lookup"
```

### Task D4: Pre-flight validation

**Files:**
- Create: `packages/cli/src/private/utils/pre-flight.ts`
- Test: `packages/cli/src/private/utils/pre-flight.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/pre-flight.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { preFlight } from "#utils/pre-flight";
import type { Instructions } from "@liolocs/powerups-sdk";
import use_errors from "#errors/useErrors";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-preflight-tmp");

function mkInstructions(steps: any[]): Instructions {
  return {
    name: "p", type: "multi-use", description: "d",
    variables: { required: ["name"], optional: [] }, intent: [], steps,
  };
}

test.case("passes when templates exist and no collisions", async assert => {
  const dir = tmpBase.append("/ok");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const rootDir = dir.append("/project");
  await fs.create(rootDir);
  await preFlight({
    instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }]),
    outputFolder: dir.append("/dist"),
    rootDir,
    variables: { name: "foo" },
    isOverwrite: false,
  });
  assert(true).true();
  await dir.remove({ recursive: true });
});

test.case("fails on missing template", async assert => {
  const dir = tmpBase.append("/missing-tmpl");
  await fs.create(dir);
  const rootDir = dir.append("/project");
  await fs.create(rootDir);
  let threw = false;
  try {
    await preFlight({
      instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/x.ts" }]),
      outputFolder: dir.append("/dist"),
      rootDir,
      variables: { name: "foo" },
      isOverwrite: false,
    });
  } catch (e) {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});

test.case("fails on create collision without --overwrite", async assert => {
  const dir = tmpBase.append("/collision");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const rootDir = dir.append("/project");
  await fs.create(rootDir.append("/src").path);
  await rootDir.append("/src/foo.ts").write("exists");
  let threw = false;
  try {
    await preFlight({
      instructions: mkInstructions([{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }]),
      outputFolder: dir.append("/dist"),
      rootDir,
      variables: { name: "foo" },
      isOverwrite: false,
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
  await dir.remove({ recursive: true });
});

test.case("defers collision check for read-produced variables", async assert => {
  const dir = tmpBase.append("/defer");
  await fs.create(dir);
  await dir.append("/dist/templates").directory.create();
  await dir.append("/dist/templates/a.ts").write("x");
  const rootDir = dir.append("/project");
  await fs.create(rootDir);
  // outputPath references {{readVar}} produced by an earlier read step — unresolved at pre-flight
  await preFlight({
    instructions: mkInstructions([
      { type: "read", name: "r", path: "src/x.txt", as: "readVar" },
      { type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{readVar}}.ts" },
    ]),
    outputFolder: dir.append("/dist"),
    rootDir,
    variables: { name: "foo" },
    isOverwrite: false,
  });
  assert(true).true();
  await dir.remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pre-flight**

Create `packages/cli/src/private/utils/pre-flight.ts`:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import type { Instructions, Step } from "@liolocs/powerups-sdk";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import use_errors from "#errors/useErrors";

export interface PreFlightArgs {
  instructions: Instructions;
  outputFolder: FileRef;
  rootDir: FileRef;
  variables: VariableResult;
  isOverwrite: boolean;
}

function templateOf(step: Step): string | undefined {
  return (step as Step & { template?: string }).template;
}

function outputPathOf(step: Step): string | undefined {
  if (step.type === "create" || step.type === "modify" || step.type === "delete") {
    return step.outputPath;
  }
  if (step.type === "read") {
    return step.path;
  }
  return undefined;
}

function stepVars(step: Step, variables: VariableResult): VariableResult {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  if (!map) return variables;
  const v: VariableResult = { ...variables };
  for (const [k, val] of Object.entries(map)) {
    v[k] = resolveTemplateString(val, v);
  }
  return v;
}

/**
 * Validate before writing anything: templates exist, create destinations don't
 * collide (unless --overwrite). Collision checks for paths that still contain
 * unresolved {{tokens}} (read-produced variables) are deferred to execution.
 */
export async function preFlight(args: PreFlightArgs): Promise<void> {
  const { instructions, outputFolder, rootDir, variables, isOverwrite } = args;
  const issues: string[] = [];

  for (const step of instructions.steps) {
    // template existence (own + _internal)
    const tmpl = templateOf(step);
    if (tmpl) {
      const ref = outputFolder.append(`/${tmpl}`);
      if (!(await fs.exists(ref))) {
        issues.push(`missing template file: ${tmpl}`);
      }
    }

    // create collisions (create only)
    if (step.type === "create") {
      const v = stepVars(step, variables);
      const resolved = resolveTemplateString(step.outputPath, v);
      if (!resolved.includes("{{")) {
        const target = rootDir.append(`/${resolved}`);
        if (await fs.exists(target)) {
          if (!isOverwrite) {
            issues.push(`destination exists: ${resolved}`);
          }
        }
      }
    }
  }

  // also surface modify/read path unresolved-file issues softly? No — modify targets
  // existing by design; read failures are execution-time. Keep pre-flight to the above.

  if (issues.length > 0) {
    throw use_errors.invalid_composition(issues);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/pre-flight.ts packages/cli/src/private/utils/pre-flight.spec.ts
git commit -m "feat(cli): add pre-flight validation pass"
```

### Task D5: Targeted revert helper

**Files:**
- Create: `packages/cli/src/private/utils/revert.ts`
- Test: `packages/cli/src/private/utils/revert.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/private/utils/revert.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { revertChanges } from "#utils/revert";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-revert-tmp");

async function freshRepo(): Promise<import("@rcompat/fs").FileRef> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  await io.run("git init", { cwd: dir.path });
  await io.run('git config user.email t@t.tt && git config user.name t', { cwd: dir.path });
  await dir.append("/existing.txt").write("orig");
  await dir.append("/package.json").write("{}");
  await io.run("git add . && git commit -m init", { cwd: dir.path });
  return dir;
}

test.case("deletes created files", async assert => {
  const dir = await freshRepo();
  await dir.append("/created.txt").write("new");
  await revertChanges(dir, [
    { path: "created.txt", action: "create" },
  ]);
  assert(await fs.exists(dir.append("/created.txt"))).false();
  await dir.remove({ recursive: true });
});

test.case("restores modified files via git checkout", async assert => {
  const dir = await freshRepo();
  await dir.append("/existing.txt").write("changed");
  await revertChanges(dir, [
    { path: "existing.txt", action: "modify" },
  ]);
  assert(await dir.append("/existing.txt").text()).equals("orig");
  await dir.remove({ recursive: true });
});

test.case("restores deleted files via git checkout", async assert => {
  const dir = await freshRepo();
  await dir.append("/existing.txt").remove();
  await revertChanges(dir, [
    { path: "existing.txt", action: "delete" },
  ]);
  assert(await fs.exists(dir.append("/existing.txt"))).true();
  await dir.remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement revert**

Create `packages/cli/src/private/utils/revert.ts`:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import cli from "@rcompat/cli";
import type { ManifestEntry } from "#utils/manifest";

/**
 * Targeted revert of a failed run's file changes against a clean-tree git repo.
 * - created files → delete
 * - modified/deleted files → git checkout -- <path> (restores HEAD)
 * node_modules changes from install steps cannot be reverted; print a notice.
 */
export async function revertChanges(
  root: FileRef,
  files: ManifestEntry["files"],
): Promise<void> {
  let touchedNodeModules = false;

  for (const file of files) {
    if (file.path.includes("node_modules")) {
      touchedNodeModules = true;
      continue;
    }
    try {
      if (file.action === "create") {
        const ref = root.append(`/${file.path}`);
        if (await fs.exists(ref)) {
          await ref.remove();
        }
      } else {
        // modify or delete — restore from HEAD
        await io.run(`git checkout -- "${file.path}"`, { cwd: root.path });
      }
    } catch (e) {
      cli.print(`Warning: could not revert ${file.path}: ${String(e)}\n`);
    }
  }

  if (touchedNodeModules) {
    cli.print(
      "Notice: node_modules changes from an install step could not be reverted. " +
      "Re-run your package manager's install command if the tree looks wrong.\n",
    );
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/revert.ts packages/cli/src/private/utils/revert.spec.ts
git commit -m "feat(cli): add targeted revert helper"
```

### Task D6: Rewrite the execution engine

**Files:**
- Rewrite: `packages/cli/src/private/utils/execute-steps.ts`
- Test: `packages/cli/src/private/utils/execute-steps.spec.ts`

- [ ] **Step 1: Write failing tests for the new engine**

Create `packages/cli/src/private/utils/execute-steps.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { executeSteps, type RunRecord } from "#utils/execute-steps";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-engine-tmp");

async function setup(): Promise<{ projectRoot: import("@rcompat/fs").FileRef; dist: import("@rcompat/fs").FileRef }> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  const projectRoot = dir.append("/project");
  const dist = dir.append("/dist");
  await fs.create(projectRoot);
  await fs.create(dist.append("/templates").path);
  await dist.append("/templates/a.ts").write("export default () => 'hello';");
  return { projectRoot, dist };
}

function mkInstructions(steps: any[]): Instructions {
  return {
    name: "p", type: "multi-use", description: "d",
    variables: { required: ["name"], optional: [] }, intent: [], steps,
  };
}

function emptyRecord(): RunRecord {
  return { steps: [], files: [], totalCharacters: 0 };
}

test.case("create step writes a file and records it", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).true();
  assert(record.files[0].action).equals("create");
  assert(record.totalCharacters).equals("hello".length);
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("variableMap resolves child names to parent values", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{
      type: "create", name: "a", template: "templates/a.ts",
      outputPath: "src/{{childName}}.ts", variableMap: { childName: "{{name}}" },
    }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).true();
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("dry-run prints and writes nothing", async assert => {
  const { projectRoot, dist } = await setup();
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "create", name: "a", template: "templates/a.ts", outputPath: "src/{{name}}.ts" }],
    variables: { name: "foo" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: true, isOverwrite: false, record,
  });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).false();
  assert(record.totalCharacters).equals("hello".length);
  await projectRoot.up(1).remove({ recursive: true });
});

test.case("delete step records delete action", async assert => {
  const { projectRoot, dist } = await setup();
  await projectRoot.append("/src").directory.create();
  await projectRoot.append("/src/old.ts").write("x");
  const record = emptyRecord();
  await executeSteps({
    steps: [{ type: "delete", name: "d", outputPath: "src/{{name}}.ts" }],
    variables: { name: "old" },
    outputFolder: dist, rootDir: projectRoot,
    isDryRun: false, isOverwrite: false, record,
  });
  assert(record.files[0].action).equals("delete");
  assert(await fs.exists(projectRoot.append("/src/old.ts"))).false();
  await projectRoot.up(1).remove({ recursive: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — `executeSteps`/`RunRecord` signatures changed.

- [ ] **Step 3: Rewrite the execution engine**

Replace the entire contents of `packages/cli/src/private/utils/execute-steps.ts` with:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import is from "@rcompat/is";
import type { Step } from "@liolocs/powerups-sdk";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import { runTemplate } from "#template-runners/index";
import { applyMultipleModifications } from "#utils/modify-engine";
import use_errors from "#errors/useErrors";

export function navigateJsonPath(json: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = json;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new Error(`JSON path "${path}" not found`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === undefined || current === null) {
    throw new Error(`JSON path "${path}" not found`);
  }
  return String(current);
}

export interface RunRecord {
  steps: { name: string; type: string; status: "applied" | "skipped-warning" | "skipped-already-applied"; from?: string }[];
  files: { path: string; action: "create" | "modify" | "delete" }[];
  totalCharacters: number;
}

export interface ExecuteStepsArgs {
  steps: Step[];
  variables: VariableResult;
  outputFolder: FileRef;
  rootDir: FileRef;
  isDryRun: boolean;
  isOverwrite: boolean;
  record: RunRecord;
}

export function resolveStepVariables(
  step: Step,
  variables: VariableResult,
): VariableResult {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  if (!map) {
    return variables;
  }
  const stepVars: VariableResult = { ...variables };
  for (const [key, value] of Object.entries(map)) {
    stepVars[key] = resolveTemplateString(value, stepVars);
  }
  return stepVars;
}

function fromOf(step: Step): string | undefined {
  return (step as Step & { from?: { name: string } }).from?.name;
}

const LOCK_FILES = [
  { file: "pnpm-lock.yaml", command: "pnpm install" },
  { file: "package-lock.json", command: "npm install" },
  { file: "yarn.lock", command: "yarn install" },
  { file: "bun.lockb", command: "bun install" },
  { file: "bun.lock", command: "bun install" },
];

function parseDepName(spec: string): string {
  if (spec.startsWith("file:") || spec.startsWith("link:") || spec.startsWith("git+") || spec.startsWith("workspace:")) {
    return spec;
  }
  const lastAt = spec.lastIndexOf("@");
  if (lastAt > 0) {
    return spec.slice(0, lastAt);
  }
  return spec;
}

async function handleInstall(
  step: Extract<Step, { type: "install" }>,
  stepVars: VariableResult,
  rootDir: FileRef,
  isDryRun: boolean,
): Promise<"applied" | "skipped-warning"> {
  const target = step.target ? resolveTemplateString(step.target, stepVars) : "";
  const pkgPath = target
    ? rootDir.append(`/${target}/package.json`)
    : rootDir.append("/package.json");
  const label = target || "root";

  const sections: { key: "dependencies" | "devDependencies" | "peerDependencies"; deps?: string[] }[] = [
    { key: "dependencies", deps: step.dependencies },
    { key: "devDependencies", deps: step.devDependencies },
    { key: "peerDependencies", deps: step.peerDependencies },
  ];

  if (isDryRun) {
    cli.print(`=== install for ${label} ===\n`);
    for (const s of sections) {
      if (s.deps && s.deps.length > 0) {
        cli.print(`  ${s.key}: ${s.deps.map(d => resolveTemplateString(d, stepVars)).join(", ")}\n`);
      }
    }
    return "applied";
  }

  if (!(await fs.exists(pkgPath))) {
    cli.print(`Warning: target package.json not found at ${label}, skipping install step.\n`);
    return "skipped-warning";
  }

  const pkg = await pkgPath.json() as Record<string, unknown>;
  let allSkipped = true;
  let wrote = false;

  for (const s of sections) {
    if (!s.deps || s.deps.length === 0) continue;
    const existing = (pkg[s.key] as Record<string, string> | undefined) ?? {};
    const merged = { ...existing };
    for (const raw of s.deps) {
      const resolved = resolveTemplateString(raw, stepVars);
      const name = parseDepName(resolved);
      if (is.defined(existing[name])) {
        cli.print(`Warning: ${name} already in ${label} ${s.key} — skipping\n`);
        continue;
      }
      merged[name] = resolved.slice(name.length + 1) || "*";
      allSkipped = false;
    }
    if (Object.keys(merged).length !== Object.keys(existing).length) {
      pkg[s.key] = merged;
      wrote = true;
    }
  }

  if (wrote) {
    await pkgPath.writeJSON(pkg);
    cli.print(`Updated ${label}/package.json\n`);
  }

  // detect lock file and run install
  let command: string | null = null;
  for (const { file, command: cmd } of LOCK_FILES) {
    if (await fs.exists(rootDir.append(`/${file}`))) {
      command = cmd;
      break;
    }
  }

  if (!command) {
    cli.print(
      "Warning: No lock file detected. package.json has been updated, but dependencies were not installed. " +
      "Run your package manager's install command manually.\n",
    );
    return allSkipped ? "skipped-warning" : "applied";
  }

  try {
    cli.print(`Running ${command}...\n`);
    const stdout = await io.run(command, { cwd: rootDir.path });
    if (is.truthy(stdout)) {
      cli.print(stdout);
    }
    cli.print("Dependency installation complete.\n");
  } catch (e) {
    if (typeof e === "string" && is.truthy(e)) {
      cli.print(e);
    }
    cli.print(
      `Warning: Dependency installation failed. Generated files are in place. ` +
      `Please run '${command}' manually.\n`,
    );
  }

  return allSkipped ? "skipped-warning" : "applied";
}

export async function executeSteps(args: ExecuteStepsArgs): Promise<void> {
  const { steps, variables, outputFolder, rootDir, isDryRun, isOverwrite, record } = args;

  for (const step of steps) {
    const stepVars = resolveStepVariables(step, variables);
    const from = fromOf(step);

    switch (step.type) {
      case "read": {
        if (isDryRun) {
          variables[step.as] = step.as;
          record.steps.push({ name: step.name, type: "read", status: "applied", from });
          break;
        }
        const resolvedPath = resolveTemplateString(step.path, stepVars);
        const targetPath = rootDir.append(`/${resolvedPath}`);
        if (!(await fs.exists(targetPath))) {
          throw use_errors.read_file_not_found(resolvedPath);
        }
        const content = await targetPath.text();
        let value: string;
        if (step.template) {
          value = await runTemplate({
            templatePath: outputFolder.append(`/${step.template}`),
            variables: { ...stepVars, __content: content },
          });
        } else if (step.jsonPath) {
          let json: unknown;
          try {
            json = JSON.parse(content);
          } catch {
            throw use_errors.read_json_parse_error(resolvedPath);
          }
          try {
            value = navigateJsonPath(json, step.jsonPath);
          } catch {
            throw use_errors.read_json_path_not_found(resolvedPath, step.jsonPath);
          }
        } else {
          value = content;
        }
        variables[step.as] = value; // parent scope
        record.steps.push({ name: step.name, type: "read", status: "applied", from });
        break;
      }

      case "create": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        const templatePath = outputFolder.append(`/${step.template}`);
        if (!(await fs.exists(templatePath))) {
          throw use_errors.template_not_found(step.template);
        }
        const rendered = await runTemplate({ templatePath, variables: stepVars });
        record.totalCharacters += rendered.length;

        if (isDryRun) {
          cli.print(`=== ${outputPath} ===\n${rendered}\n\n`);
          record.steps.push({ name: step.name, type: "create", status: "applied", from });
          break;
        }

        const targetPath = rootDir.append(`/${outputPath}`);
        const existed = await fs.exists(targetPath);
        if (existed && !isOverwrite) {
          throw use_errors.destination_file_exists(outputPath);
        }
        await fs.create(targetPath.directory);
        await targetPath.write(rendered);
        record.files.push({ path: outputPath, action: existed ? "modify" : "create" });
        record.steps.push({ name: step.name, type: "create", status: "applied", from });
        cli.print(`Wrote ${outputPath}\n`);
        break;
      }

      case "modify": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        if (isDryRun) {
          const templatePath = outputFolder.append(`/${step.template}`);
          const ext = templatePath.extension;
          const modContent = ext === ".json"
            ? await templatePath.text()
            : await runTemplate({ templatePath, variables: stepVars });
          record.totalCharacters += modContent.length;
          cli.print(`=== ${outputPath} (modify) ===\n${modContent}\n\n`);
          record.steps.push({ name: step.name, type: "modify", status: "applied", from });
          break;
        }

        try {
          const targetPath = rootDir.append(`/${outputPath}`);
          const existed = await fs.exists(targetPath);
          const applied = await applyMultipleModifications({
            task: {
              templatePath: outputFolder.append(`/${step.template}`),
              outputPath,
              variables: stepVars,
            },
            rootDir,
            errors: use_errors,
          });
          record.totalCharacters += applied.content.length;
          await fs.create(targetPath.directory);
          await targetPath.write(applied.content);
          record.files.push({ path: outputPath, action: existed ? "modify" : "create" });
          record.steps.push({ name: step.name, type: "modify", status: "applied", from });
          cli.print(`Modified ${outputPath}\n`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          cli.print(`Warning: skipped modification for ${outputPath} — ${message}\n`);
          record.steps.push({ name: step.name, type: "modify", status: "skipped-warning", from });
        }
        break;
      }

      case "delete": {
        const outputPath = resolveTemplateString(step.outputPath, stepVars);
        if (isDryRun) {
          cli.print(`=== ${outputPath} (delete) ===\nWould delete\n\n`);
          record.steps.push({ name: step.name, type: "delete", status: "applied", from });
          break;
        }
        const targetPath = rootDir.append(`/${outputPath}`);
        const existed = await fs.exists(targetPath);
        if (!existed) {
          cli.print(`Warning: file not found, skipping: ${outputPath}\n`);
          record.steps.push({ name: step.name, type: "delete", status: "skipped-warning", from });
          break;
        }
        await targetPath.remove();
        record.files.push({ path: outputPath, action: "delete" });
        record.steps.push({ name: step.name, type: "delete", status: "applied", from });
        cli.print(`Deleted ${outputPath}\n`);
        break;
      }

      case "install": {
        const status = await handleInstall(step, stepVars, rootDir, isDryRun);
        record.steps.push({ name: step.name, type: "install", status, from });
        break;
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx proby`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/execute-steps.ts packages/cli/src/private/utils/execute-steps.spec.ts
git commit -m "feat(cli): rewrite execution engine (variableMap, inline install, RunRecord)"
```

---

## Phase E — Rewrite the `use` command

### Task E1: Rewrite `use` to the new flow

**Files:**
- Rewrite: `packages/cli/src/private/commands/use/index.ts`
- Test: `packages/cli/src/private/commands/use/use.spec.ts` (create a smoke test)

- [ ] **Step 1: Write a smoke test for the new use flow**

Create `packages/cli/src/private/commands/use/use.spec.ts`:

```typescript
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import { buildPowerup } from "#commands/build/index";
import use from "#commands/use/index";

const root = await runtime.projectRoot();
const tmpBase = root.append("/.test-use-tmp");

async function setupBuiltPowerup(): Promise<{ projectRoot: import("@rcompat/fs").FileRef; powerupDir: import("@rcompat/fs").FileRef }> {
  const dir = tmpBase.append(`/${Date.now()}`);
  await fs.create(dir);
  const projectRoot = dir.append("/project");
  const powerupDir = dir.append("/powerup");
  await fs.create(projectRoot);
  await fs.create(powerupDir);

  // project: git repo + .powerups config pointing at the powerup
  await io.run("git init", { cwd: projectRoot.path });
  await io.run('git config user.email t@t.tt && git config user.name t', { cwd: projectRoot.path });
  await projectRoot.append("/.powerups").directory.create();
  await projectRoot.append("/.powerups/config.json").write(
    JSON.stringify({ harness: "pi", packages: ["pup-internal"] }),
  );
  // minimal "pup-internal" package dir with a multi-use map entry
  await projectRoot.append("/.powerups/internal").directory.create();
  await projectRoot.append("/.powerups/internal/package.json").write(
    JSON.stringify({
      name: "pup-internal",
      keywords: ["powerups-package"],
      powerups: { active: { "multi-use": { "test-powerup": "test-powerup/dist/index.js" } } },
    }),
  );

  // powerup package
  await powerupDir.append("/package.json").write(
    JSON.stringify({
      name: "test-powerup", version: "1.0.0", keywords: ["powerups-package"],
      powerup: { instructions: "index.ts" },
      files: ["dist"], exports: { ".": { import: "./dist/index.js", types: "./dist/index.d.ts" } },
      devDependencies: { "@liolocs/powerups-sdk": "link:" + root.append("/packages/sdk").path },
    }),
  );
  await powerupDir.append("/templates").directory.create();
  await powerupDir.append("/templates/comp.ts").write("export default () => 'hi';");
  await powerupDir.append("/index.ts").write(
    `import { defineInstructions } from "@liolocs/powerups-sdk";\n` +
    `export default defineInstructions({\n` +
    `  name: "test-powerup", type: "multi-use", description: "d",\n` +
    `  variables: { required: ["name"], optional: [] }, intent: [],\n` +
    `  steps: [{ type: "create", name: "comp", template: "templates/comp.ts", outputPath: "src/{{name}}.ts" }],\n` +
    `}, import.meta.url);\n`,
  );
  // copy built powerup dist into the project's internal store path
  await buildPowerup(powerupDir);
  await fs.create(projectRoot.append("/.powerups/internal/test-powerup").path);
  await powerupDir.append("/dist").copy(projectRoot.append("/.powerups/internal/test-powerup/dist"));

  return { projectRoot, powerupDir };
}

test.case("use writes the generated file and records the manifest", async assert => {
  const { projectRoot } = await setupBuiltPowerup();
  await use.run(["test-powerup", "--name=foo"], { root: projectRoot });
  assert(await fs.exists(projectRoot.append("/src/foo.ts"))).true();
  const manifest = await projectRoot.append("/.powerups/manifest.jsonl").text();
  assert(manifest.includes("test-powerup")).true();
  await projectRoot.up(1).remove({ recursive: true });
});
```

> Note: the exact `use.run` invocation signature depends on `@liolocs/program`; if the test harness invokes commands differently, adapt the call to match existing command specs in the repo. The assertion is the contract: file written + manifest line appended.

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/cli && npx proby`
Expected: FAIL — `use` still uses worktrees/applied-manifest.

- [ ] **Step 3: Rewrite the `use` command**

Replace the entire contents of `packages/cli/src/private/commands/use/index.ts` with:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import use_errors from "#errors/useErrors";
import { instructionsSchema, type Instructions, type Step } from "@liolocs/powerups-sdk";
import { extractVariables } from "#utils/variables";
import { executeSteps, type RunRecord } from "#utils/execute-steps";
import { preFlight } from "#utils/pre-flight";
import { revertChanges } from "#utils/revert";
import { verifyGitRepo, ensureCleanTree } from "#utils/git";
import { readManifest, appendManifestEntry, hasBeenApplied } from "#utils/manifest";
import { logRun } from "#utils/metrics";
import { resolvePowerUp } from "#utils/resolve-powerup";
import {
  CAPITALIZED_SINGLULAR_CLI_NAME,
  MAIN_FOLDER,
  PACKAGE_FILE,
  SINGULAR_NAME,
  type PowerUpType,
} from "#constants";

const EXCLUDE_FLAGS = ["--dry-run", "-d", "--overwrite", "-O", "--help", "-h", "--type", "-t"];

function buildManifestEntry(
  instructions: Instructions,
  record: RunRecord,
  meta: { packageName: string; version: string; location: "local" | "global"; variables: Record<string, string> },
): import("#utils/manifest").ManifestEntry {
  return {
    powerup: instructions.name,
    package: meta.packageName,
    version: meta.version,
    location: meta.location,
    type: instructions.type,
    timestamp: new Date().toISOString(),
    variables: meta.variables,
    steps: record.steps,
    files: record.files,
  };
}

function includedPowerupEntries(
  instructions: Instructions,
  record: RunRecord,
  meta: { packageName: string; version: string; location: "local" | "global"; variables: Record<string, string> },
): import("#utils/manifest").ManifestEntry[] {
  // group applied steps by `from.name` → one entry per included powerup
  const byName = new Map<string, typeof record.steps>();
  for (const s of record.steps) {
    if (s.from && s.from !== instructions.name && s.status !== "skipped-already-applied") {
      const arr = byName.get(s.from) ?? [];
      arr.push(s);
      byName.set(s.from, arr);
    }
  }
  const entries: import("#utils/manifest").ManifestEntry[] = [];
  for (const [name, steps] of byName) {
    const childType = steps.some(s => s.from === name) ? "multi-use" : "multi-use";
    entries.push({
      powerup: name,
      package: meta.packageName,
      version: meta.version,
      location: meta.location,
      type: childType,
      timestamp: new Date().toISOString(),
      variables: {},
      steps,
      files: record.files.filter(f => f.path.includes(name)),
    });
  }
  return entries;
}

const use = new Command({
  name: "use",
  description: `Use a ${SINGULAR_NAME}, rendering templates with variables`,
  flags: [
    { name: "type", long: "type", short: "t", description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use) for disambiguation` },
    { name: "dry-run", long: "dry-run", short: "d", description: "Print output to stdout instead of writing files" },
    { name: "overwrite", long: "overwrite", short: "O", description: "Overwrite existing destination files for create actions" },
  ],
  subcommands: [],
  action: async ({ subcommands, rawFlags, flags, context }) => {
    const name = subcommands?.[0];
    if (!is.defined(name)) {
      throw use_errors.missing_name();
    }

    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    if (!(await fs.exists(mainFolder))) {
      throw use_errors.main_folder_not_found();
    }

    const typeFlag = is.defined(flags.type) ? (flags.type as PowerUpType) : undefined;
    const resolved = await resolvePowerUp(root, name, typeFlag);
    const packageDir = resolved.folder.up(1);
    const outputFolder = resolved.folder;

    if (!(await fs.exists(outputFolder.append("/instructions.json")))) {
      throw use_errors.instructions_not_built(name);
    }

    const instructions = instructionsSchema.parse(
      await outputFolder.append("/instructions.json").json(),
    );

    const variables = extractVariables({
      rawFlags: rawFlags ?? [],
      required: instructions.variables.required,
      optional: instructions.variables.optional ?? [],
      excludeFlags: EXCLUDE_FLAGS,
      onMissing: (missing) => {
        throw use_errors.missing_variables(missing, instructions.variables.required, name);
      },
    });

    const isDryRun = (rawFlags ?? []).some(f => f.flag === "--dry-run" || f.flag === "-d");
    const isOverwrite = (rawFlags ?? []).some(f => f.flag === "--overwrite" || f.flag === "-O");

    // single-use check (top-level)
    if (instructions.type === "single-use" && (await hasBeenApplied(root, instructions.name))) {
      throw use_errors.already_applied(instructions.name);
    }

    // skip steps from already-applied included single-use powerups
    const manifest = await readManifest(root);
    const appliedNames = new Set(manifest.map(e => e.powerup));
    const effectiveSteps = instructions.steps.map(step => {
      const from = (step as Step & { from?: { name: string; singleUse: boolean } }).from;
      if (from?.singleUse && appliedNames.has(from.name)) {
        return { ...step, __skipAlreadyApplied: true } as Step & { __skipAlreadyApplied?: boolean };
      }
      return step;
    });

    const record: RunRecord = { steps: [], files: [], totalCharacters: 0 };

    // version for manifest
    let version = "0.0.0";
    try {
      const pkgJson = await packageDir.append(`/${PACKAGE_FILE}`).json() as { version?: string };
      version = pkgJson.version ?? version;
    } catch { /* best-effort */ }

    const meta = { packageName: resolved.packageName, version, location: resolved.location, variables };

    if (isDryRun) {
      // dry-run: no git checks, no manifest
      const runnable = effectiveSteps.filter(s => !(s as Step & { __skipAlreadyApplied?: boolean }).__skipAlreadyApplied);
      await executeSteps({
        steps: runnable, variables, outputFolder, rootDir: root,
        isDryRun: true, isOverwrite, record,
      });
      for (const s of effectiveSteps) {
        if ((s as Step & { __skipAlreadyApplied?: boolean }).__skipAlreadyApplied) {
          record.steps.push({ name: s.name, type: s.type, status: "skipped-already-applied", from: (s as Step & { from?: { name: string } }).from?.name });
        }
      }
      return;
    }

    // non-dry-run: clean git state required
    await verifyGitRepo(root);
    await ensureCleanTree(root);

    // pre-flight
    await preFlight({ instructions, outputFolder, rootDir: root, variables, isOverwrite });

    const runnable = effectiveSteps.filter(s => !(s as Step & { __skipAlreadyApplied?: boolean }).__skipAlreadyApplied);

    try {
      await executeSteps({
        steps: runnable, variables, outputFolder, rootDir: root,
        isDryRun: false, isOverwrite, record,
      });
    } catch (error) {
      await revertChanges(root, record.files);
      throw error;
    }

    // record skipped-already-applied steps
    for (const s of effectiveSteps) {
      if ((s as Step & { __skipAlreadyApplied?: boolean }).__skipAlreadyApplied) {
        record.steps.push({ name: s.name, type: s.type, status: "skipped-already-applied", from: (s as Step & { from?: { name: string } }).from?.name });
      }
    }

    // no-op: every step skipped
    if (record.steps.every(s => s.status !== "applied")) {
      cli.print(`Nothing to do — all steps already applied or skipped.\n`);
      return;
    }

    // append manifest entries (parent + each included powerup)
    await appendManifestEntry(root, buildManifestEntry(instructions, record, meta));
    for (const entry of includedPowerupEntries(instructions, record, meta)) {
      await appendManifestEntry(root, entry);
    }

    // metrics (best-effort)
    try {
      await logRun(
        { output: name, characters: record.totalCharacters },
        { cwd: root.path, globalRoot: context?.globalRoot },
      );
    } catch { /* secondary */ }
  },
});

export default use;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/cli && npx tsgo && npx proby`
Expected: PASS — use smoke test writes file + manifest line.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/commands/use/index.ts packages/cli/src/private/commands/use/use.spec.ts
git commit -m "feat(cli): rewrite use command (clean-state atomicity, manifest, single-use)"
```

---

## Phase F — Deletions and cleanup

### Task F1: Remove obsolete commands, utilities, and schemas

**Files:**
- Delete: `commands/info/`, `commands/validate/`, `utils/check-output.ts`, `utils/validate-output.ts`, `utils/applied-manifest.ts`, `schemas/applied.ts`, worktree helpers, `dependencies.ts` (collect/apply/detect)
- Modify: `packages/cli/src/commands/index.ts`

- [ ] **Step 1: Remove info and validate from the command registry**

In `packages/cli/src/commands/index.ts`, remove the `info` and `validate` imports and array entries:

```typescript
import { type Command } from "@liolocs/program";
import add from "./add.js";
import build from "./build.js";
import create from "./create.js";
import doctor from "./doctor.js";
import find from "./find.js";
import install from "./install.js";
import list from "./list.js";
import metrics from "./metrics.js";
import pack from "./pack.js";
import project from "./project.js";
import update from "./update.js";
import use from "./use.js";

const commands: Command<any>[] = [
  add, build, create, doctor, find, install, list, metrics, pack, project, update, use,
];
export default commands;
```

- [ ] **Step 2: Delete obsolete files**

```bash
git rm -r packages/cli/src/private/commands/info packages/cli/src/private/commands/validate
git rm packages/cli/src/private/utils/check-output.ts packages/cli/src/private/utils/check-output.spec.ts
git rm packages/cli/src/private/utils/validate-output.ts packages/cli/src/private/utils/validate-output.spec.ts
git rm packages/cli/src/private/utils/applied-manifest.ts packages/cli/src/private/utils/applied-manifest.spec.ts
git rm packages/cli/src/private/schemas/applied.ts packages/cli/src/private/schemas/applied.spec.ts
```

- [ ] **Step 3: Trim worktree.ts to keep only verifyGitRepo (or delete fully)**

`verifyGitRepo` was moved to `#utils/git` in Task D1. Delete `worktree.ts` entirely:

```bash
git rm packages/cli/src/private/utils/worktree.ts packages/cli/src/private/utils/worktree.spec.ts
```

Confirm no remaining imports of `#utils/worktree`:

```bash
grep -rn "#utils/worktree" packages/cli/src || echo "none"
```
Expected: `none`. If any remain, redirect them to `#utils/git`.

- [ ] **Step 4: Trim dependencies.ts to remove obsolete functions**

In `packages/cli/src/private/utils/dependencies.ts`, delete `detectPackageManager`, `applyDependencies`, `collectDependencies`, `parseDep`, `mergeDeps`, `PackageDependencyGroup`, `PackageManager`, and the `LOCK_FILES` constant (all absorbed by the `install` step handler in `execute-steps.ts`). Keep the file only if other code still imports from it; otherwise delete it:

```bash
grep -rn "#utils/dependencies" packages/cli/src || echo "none"
```
If `none`, `git rm packages/cli/src/private/utils/dependencies.ts packages/cli/src/private/utils/dependencies.spec.ts`. Otherwise leave only the still-used symbols.

- [ ] **Step 5: Remove obsolete use_errors entries**

In `packages/cli/src/private/errors/useErrors.ts`, delete `worktree_creation_failed` and `worktree_apply_failed` (already done in Task D2 if applied; double-check). Confirm `git_repo_required` remains.

- [ ] **Step 6: Verify the CLI compiles and tests pass**

Run: `cd packages/cli && npx tsgo && npx proby`
Expected: PASS — no dangling imports, no references to deleted symbols.

- [ ] **Step 7: Commit**

```bash
git add -A packages/cli/src
git commit -m "refactor(cli): delete obsolete info/validate commands, worktree, dependencies, applied-manifest"
```

### Task F2: Update create-utils to emit `install` steps

**Files:**
- Modify: `packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts`
- Modify: `packages/cli/src/private/utils/create/get-package-deps.ts` (if it references `PackageDependencyGroup`)

- [ ] **Step 1: Inspect current dependency emission**

Run: `grep -n "packageDependencies\|PackageDependencyGroup\|dependencies:" packages/cli/src/private/utils/create/steps/extract-deps-from-package-changes.ts packages/cli/src/private/utils/create/get-package-deps.ts`

This shows where `PackageDependencyGroup[]` is produced and fed into `instructions.packageDependencies`.

- [ ] **Step 2: Emit `install` steps instead of `packageDependencies`**

In `extract-deps-from-package-changes.ts`, change the return type and construction: instead of pushing `PackageDependencyGroup` objects onto a `newPackageDependencies` array, construct an `install` step and push it onto the steps array. Replace the group construction (the `extractPackageDependencies` return that builds `{ target, dependencies, devDependencies, peerDependencies }`) with:

```typescript
const installStep = {
  type: "install" as const,
  name: `install-${change.path.replace(/\//g, "-")}`,
  target: targetPath,
  dependencies: extractedDeps.filter(d => d.section === "dependencies").map(d => d.spec),
  devDependencies: extractedDeps.filter(d => d.section === "devDependencies").map(d => d.spec),
  peerDependencies: extractedDeps.filter(d => d.section === "peerDependencies").map(d => d.spec),
};
```

Adapt to the actual shape returned by `extractPackageDependencies` in that file (it currently returns `{ dependencies: ..., hasNonDependencyChanges }`; carry the per-section detail that already exists there). The downstream `create-step-from-new-file.ts` / `create-step-from-modified-file.ts` that merge these into `instructions.steps` now receive an `install` step rather than a `packageDependencies` group. Remove the `instructions.packageDependencies` assignment wherever it occurs in `create-powerup.ts`.

- [ ] **Step 3: Verify with the create command's tests**

Run: `cd packages/cli && npx proby`
Expected: PASS — create-command tests (if any exist) pass; if they assert `packageDependencies`, update them to assert `install` steps.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/private/utils/create
git commit -m "refactor(cli): emit install steps instead of packageDependencies in create"
```

---

## Phase G — Migrate the internal powerups

### Task G1: Migrate `cli-command`

**Files:**
- Modify: `.powerups/_internal/cli-command/index.ts`
- Modify: `.powerups/_internal/cli-command/package.json`

- [ ] **Step 1: Update `index.ts`**

In `.powerups/_internal/cli-command/index.ts`, replace the import and default export:

```typescript
import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";
```

…keep the `instructions` object unchanged, and change the final line from:

```typescript
export default () => instructionsSchema.parse(instructions);
```

to:

```typescript
export default defineInstructions(instructions, import.meta.url);
```

Remove the now-unused `instructionsSchema` import.

- [ ] **Step 2: Update `package.json`**

In `.powerups/_internal/cli-command/package.json`, set `files` and `exports` and add `tsup`:

```json
{
  "name": "cli-command",
  "version": "1.0.0",
  "description": "Scaffold a CLI with a command",
  "type": "module",
  "scripts": { "build": "pup build" },
  "keywords": ["powerups-package"],
  "powerup": { "instructions": "index.ts", "compatibility": {} },
  "files": ["dist"],
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "devDependencies": {
    "@liolocs/powerups-sdk": "link:../../packages/sdk",
    "tsup": "^8.5.1"
  }
}
```

- [ ] **Step 3: Build and verify**

```bash
cd .powerups/_internal/cli-command && pup build
```
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/instructions.json`, `dist/templates/` present.

- [ ] **Step 4: Commit**

```bash
git add .powerups/_internal/cli-command
git commit -m "feat(powerup): migrate cli-command to defineInstructions"
```

### Task G2: Migrate `cli-sub-command`

**Files:**
- Modify: `.powerups/_internal/cli-sub-command/index.ts`
- Modify: `.powerups/_internal/cli-sub-command/package.json`

- [ ] **Step 1: Update `index.ts`**

Same change as Task G1 Step 1 (replace import + default export with `defineInstructions(instructions, import.meta.url)`, remove the `instructionsSchema` import). The `instructions` object is unchanged.

- [ ] **Step 2: Update `package.json`**

Identical structure to Task G1 Step 2 with `name: "cli-sub-command"` and `description: "Scaffold a CLI with a command"`.

- [ ] **Step 3: Build and verify**

```bash
cd .powerups/_internal/cli-sub-command && pup build
```
Expected: `dist/` populated as in G1.

- [ ] **Step 4: Commit**

```bash
git add .powerups/_internal/cli-sub-command
git commit -m "feat(powerup): migrate cli-sub-command to defineInstructions"
```

### Task G3: Migrate `cli-with-sub-command` (the parent)

**Files:**
- Modify: `.powerups/_internal/cli-with-sub-command/index.ts`
- Modify: `.powerups/_internal/cli-with-sub-command/package.json`

- [ ] **Step 1: Rewrite `index.ts`**

Replace the entire contents of `.powerups/_internal/cli-with-sub-command/index.ts` with the parent example from the spec (the `includePowerup` version with `namespace: "command"` and `namespace: "subcommand"`):

```typescript
import { defineInstructions, includePowerup, type Instructions } from "@liolocs/powerups-sdk";
import cliCommand from "cli-command";
import cliSubCommand from "cli-sub-command";

const instructions: Instructions = {
  name: "cli-with-sub-commands",
  type: "multi-use",
  description: "Scaffold a CLI with subcommands",
  variables: {
    required: [
      "commandName",
      "description",
      "subcommandName",
      "subcommandDescription",
      "subcommandFlags",
      "subcommandErrorCases",
    ],
    optional: ["errorCases"],
  },
  intent: [
    "create a new command and perhaps subcommands for a CLI command",
    "scaffold a command and subcommands with flags and error handling",
    "combined command and subcommands",
  ],
  steps: [
    {
      type: "create",
      name: "parent-command.ts",
      template: "templates/parent-command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    ...includePowerup(cliCommand, {
      namespace: "command",
      variables: {
        commandName: "{{commandName}}",
        description: "{{description}}",
        flags: "[]",
        errorCases: "{{errorCases}}",
      },
      excludeSteps: ["command", "spec"],
    }),
    ...includePowerup(cliSubCommand, {
      namespace: "subcommand",
      variables: {
        parentCommand: "{{commandName}}",
        subcommandName: "{{subcommandName}}",
        description: "{{subcommandDescription}}",
        flags: "{{subcommandFlags}}",
        errorCases: "{{subcommandErrorCases}}",
      },
      excludeSteps: ["modify-index"],
    }),
  ],
};

export default defineInstructions(instructions, import.meta.url);
```

- [ ] **Step 2: Update `package.json`**

```json
{
  "name": "cli-with-sub-command",
  "version": "1.0.0",
  "description": "Scaffold a CLI with subcommands",
  "type": "module",
  "scripts": { "build": "pup build" },
  "keywords": ["powerups-package"],
  "powerup": { "instructions": "index.ts", "compatibility": {} },
  "files": ["dist"],
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "devDependencies": {
    "@liolocs/powerups-sdk": "link:../../packages/sdk",
    "tsup": "^8.5.1",
    "cli-command": "file:../cli-command",
    "cli-sub-command": "file:../cli-sub-command"
  }
}
```

- [ ] **Step 3: Install child deps and build**

```bash
cd .powerups/_internal/cli-with-sub-command && pnpm install && pup build
```
Expected: `dist/` populated, including `dist/_internal/command/templates/` and `dist/_internal/subcommand/templates/` bundled from the children's `dist/`.

- [ ] **Step 4: Commit**

```bash
git add .powerups/_internal/cli-with-sub-command
git commit -m "feat(powerup): migrate cli-with-sub-command to includePowerup"
```

---

## Phase H — End-to-end verification

### Task H1: Build order and end-to-end `pup use`

- [ ] **Step 1: Build in dependency order**

```bash
cd .powerups/_internal/cli-command && pup build
cd .powerups/_internal/cli-sub-command && pup build
cd .powerups/_internal/cli-with-sub-command && pup build
```
Expected: each succeeds; the parent's `dist/_internal/` contains `command/` and `subcommand/` template trees.

- [ ] **Step 2: Verify the parent's instructions.json is self-contained**

```bash
cat .powerups/_internal/cli-with-sub-command/dist/instructions.json
```
Expected: no `include` steps; flattened `create`/`modify` steps with `_internal/<namespace>/templates/...` paths, `variableMap`, `from` fields; no `__source`; no `packageDependencies`.

- [ ] **Step 3: Run the parent end-to-end in a scratch project**

```bash
mkdir -p /tmp/pup-e2e && cd /tmp/pup-e2e && git init && \
  git config user.email t@t.tt && git config user.name t && \
  echo '{}' > package.json && git add . && git commit -m init && \
  pup project init --harness pi && \
  pup use cli-with-sub-commands \
    --command-name=greet --description="greet" \
    --subcommand-name=hello --subcommand-description="hello" \
    --subcommand-flags="[]" --subcommand-error-cases="[]"
```
Expected: generated command + subcommand files written; `git status` clean (commit the result); `.powerups/manifest.jsonl` contains entries for `cli-with-sub-commands`, `cli-command`, and `cli-sub-command`.

- [ ] **Step 4: Verify single-use enforcement**

Temporarily flip `cli-command` to `type: "single-use"`, rebuild it and the parent, run `pup use cli-command` standalone, then run the parent again — the parent's `command:` steps should be recorded as `skipped-already-applied`. Revert the type change afterward.

- [ ] **Step 5: Verify atomicity**

In the scratch project with a clean tree, introduce a powerup whose 2nd step references a missing template. Run `pup use ...`; expected: failure with revert notice, `git status` clean (no half-written files), no manifest entry.

- [ ] **Step 6: Commit any fixups and the plan**

```bash
git add -A && git commit -m "test: end-to-end verification of include powerup design"
```

---

## Self-Review Notes

**Spec coverage** — mapped each spec section to tasks: SDK helpers (A1–A3), schema consolidation (B1), build (C1–C4), runtime engine + atomicity + manifest + single-use (D1–D6, E1), deletions (F1), create-utils install steps (F2), powerup migrations (G1–G3), e2e (H1).

**Type consistency** — `RunRecord` defined once (D6) and used identically in E1; `ManifestEntry` defined once (D3) and imported in E1/D5; `StepOverrideValue` defined in A1 and referenced in A2; `resolveStepVariables` defined in D6 and mirrored in D4's pre-flight `stepVars`. `build_validation`'s `ownNamespaces` is a `Set<string>` in both C3 and C4.

**Known follow-ups (not blocking)** — the `use` smoke test (E1) invokes `use.run(...)`; the exact program invocation may need adjusting to the repo's command-test convention. `includedPowerupEntries` infers child `type` conservatively as `multi-use` (single-use child entries are still recorded; the single-use *check* uses `from.singleUse` on steps, not the entry's `type`, so this is safe). The old `applied.json` is abandoned without migration — note in the PR.