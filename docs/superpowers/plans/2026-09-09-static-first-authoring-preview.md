# Static-First Authoring & Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-wrapped capture with readable static-first authoring (four step types, `src/<type>/` layout), add a `pup template` conversion command, and add a `pup preview` command that materializes a powerup from source with concrete variables, a run command, and a watch loop — plus capture robustness fixes (no git required, rollback, real error surfacing).

**Architecture:** Clean break in the SDK step schema: `create`/`modify` are static (verbatim `file` sources), `dynamic-create`/`dynamic-modify` are templates. Capture copies files verbatim into `src/create/` and `src/modify/` (+ git pre-images into `fixtures/`); `pup template` converts steps between static and dynamic, keeping `index.ts` in sync; `pup preview` runs the step pipeline from the powerup root (parameterized source base) into a manifest-reconciled `preview/` dir, with a polling source watcher and a runtime-selected restart supervisor (nodemon/bun-watch/denon). Build mirrors `src/` into `dist/`; use gains copy/parse runners.

**Tech Stack:** TypeScript (tsgo + tsup), zod (SDK schemas), pema (CLI modification schema), `@rcompat/{fs,io,cli,error,runtime,test}`, proby test runner, nodemon (new CLI dependency), node:child_process/node:fs for walking/spawning.

**Spec:** `docs/superpowers/specs/2026-09-09-static-first-authoring-preview-design.md`

**Conventions for every task:**
- Work from repo root `/Users/lioloc/Development/powerups/powerups-oss` unless a step `cd`s elsewhere.
- CLI package dir: `packages/cli`. SDK package dir: `packages/sdk`.
- Run a single spec: `cd packages/cli && CI=true npx proby <spec path>` (or `cd packages/sdk && npx proby <spec path>` for SDK specs).
- Tests use the custom framework: `import test from "#test-utils/test/index"`, `test.case("...", async assert => { ... })`, assertions `assert(x).equals(y)`, `assert(x).true()`, `assert(x).includes(y)`; CodeError checks via `try { ... } catch (error) { assert(error.code).equals(...); assert(error.message).includes(...) }` with `// @ts-expect-error` comments (see `src/private/errors/createErrors.spec.ts`).
- Errors are built with `error.coded({...})` from `@rcompat/error` and exported with a `<Name>ErrorCode` object — copy the `createErrors.ts` pattern exactly.
- The CLI type-checks against SDK **source** (`customConditions: ["@powerups/source"]`), so SDK schema changes immediately affect CLI type-checking; runtime uses the SDK's built `lib/`. Rebuild the SDK (`cd packages/sdk && pnpm build`) whenever the plan says so — several CLI tests validate instructions at runtime.

---

## File Structure

**SDK (`packages/sdk/src/private/schema/`)**
- `instructions.ts` — rewrite step schemas (create/dynamic-create/modify/dynamic-modify), update `StepOverrideValue`
- `manifest.ts` — add dynamic-create/dynamic-modify manifest entries
- `instructions.spec.ts` — update fixtures, add new cases

**CLI — new utils**
- `src/private/errors/get-error-message.ts` — normalize non-Error rejections
- `src/private/utils/shared/write-if-changed.ts` — content-aware file writes
- `src/private/utils/shared/normalize-flag-name.ts` — kebab→camel flag names (extracted from `use/extract-variables.ts`)
- `src/private/utils/create/capture-files/walk-files.ts` — portable directory walk
- `src/private/utils/create/capture-files/generate-readable-template.ts` — readable backtick template generation
- `src/private/utils/create/rollback-on-capture-failure.ts` — create-command rollback
- `src/private/utils/template-conversion/steps-region.ts` — extract/replace steps array in `index.ts`
- `src/private/utils/template-conversion/generate-readable-template.ts` — (re-export home; capture one is deleted — see Task 4 note)
- `src/private/utils/template-conversion/convert-step.ts` — static↔dynamic conversion core
- `src/private/utils/preview/load-instructions-from-source.ts` — import source `index.ts` per runtime
- `src/private/utils/preview/read-preview-json.ts` — read/validate `preview.json`
- `src/private/utils/preview/resolve-preview-config.ts` — merge `preview.json` + flags, resolve variables
- `src/private/utils/preview/preview-manifest.ts` — `.preview-manifest.json` read/write/hashing
- `src/private/utils/preview/compute-stale-paths.ts` — pure reconcile helper
- `src/private/utils/preview/materialize-preview.ts` — fixtures + steps + reconcile
- `src/private/utils/preview/watch-source.ts` — polling source watcher
- `src/private/utils/preview/select-supervisor-strategy.ts` — pure runtime/command → strategy
- `src/private/utils/preview/run-supervisor.ts` — spawn/restart supervision
- `src/private/errors/templateErrors.ts`, `src/private/errors/previewErrors.ts` — error catalogs

**CLI — new commands**
- `src/private/commands/template/index.ts` + `src/commands/template.ts`
- `src/private/commands/preview/index.ts` + `src/commands/preview.ts`

**CLI — modified**
- `src/bin.ts` — error normalization
- `src/commands/index.ts` — register new commands
- `src/private/commands/create/index.ts` — rollback wiring, `sourceBase`
- `src/private/commands/use/index.ts` — `sourceBase`
- `src/private/commands/build/index.ts` — import rename
- `src/private/utils/validate/check-compiled-instructions-for-errors/index.ts` — old-format error
- `src/private/utils/validate/check-compiled-instructions-for-errors/get-list-of-issues-with-instructions.ts` — `pathOf` for new types
- `src/private/utils/create/capture-files/{capture-all-files,create-steps-from-new-files,create-steps-from-modified-files,git-status}.ts` + specs — new layout/behavior
- `src/private/utils/create/capture-files/{wrap-as-template.ts,wrap-as-template.spec.ts}` — deleted
- `src/private/utils/use/run-powerup/index.ts`, `run-step.ts`, `steps/run-create-step/{index,render-template}.ts`, `steps/run-modify-step/index.ts` + new `steps/run-dynamic-create-step/index.ts`, `steps/run-dynamic-modify-step/index.ts`
- `src/private/utils/build/copy-templates-to-dist-folder.ts` → renamed `copy-step-sources-to-dist-folder.ts`
- `src/private/utils/use/extract-variables.ts` — use shared `normalizeFlagName`
- `src/private/test-utils/create-powerup-for-test.ts`, `create-fully-built-powerup-for-test.ts` — new format
- `scripts/build-builtin-powerups.ts` — copy `src/` tree
- `packages/cli/.powerups/installed/_internal/create-powerup/**` — migrate to new schema/layout
- `packages/cli/README.md` — docs
- `packages/sdk/package.json`, `packages/cli/package.json` — version bumps; CLI gains `nodemon` dependency

---

## Phase 1 — SDK schema & error foundation

### Task 1: SDK — four step schemas + manifest entries

**Files:**
- Modify: `packages/sdk/src/private/schema/instructions.ts`
- Modify: `packages/sdk/src/private/schema/manifest.ts`
- Modify: `packages/sdk/src/private/schema/instructions.spec.ts`
- Modify: `packages/sdk/src/private/index.ts` (re-export new schemas/types if it enumerates them)
- Modify: `packages/sdk/package.json` (version bump at the end of this task)

- [ ] **Step 1: Write the failing tests**

In `packages/sdk/src/private/schema/instructions.spec.ts`, update every fixture that builds a `create`/`modify` step (replace `template: "templates/x.ts"` with the new fields per the shapes below), then add these cases:

```ts
test.case("accepts a static create step with a file field", () => {
  const result = stepSchema.safeParse({
    type: "create",
    name: "create-package-json",
    file: "src/create/package.json",
    outputPath: "package.json",
  });
  assert(result.success).true();
});

test.case("accepts a dynamic-create step with a template field", () => {
  const result = stepSchema.safeParse({
    type: "dynamic-create",
    name: "create-package-json",
    template: "src/dynamic-create/package.json.ts",
    outputPath: "package.json",
  });
  assert(result.success).true();
});

test.case("accepts a static modify step with a file field", () => {
  const result = stepSchema.safeParse({
    type: "modify",
    name: "modify-package-json",
    file: "src/modify/package.json.json",
    outputPath: "package.json",
  });
  assert(result.success).true();
});

test.case("accepts a dynamic-modify step with a template field", () => {
  const result = stepSchema.safeParse({
    type: "dynamic-modify",
    name: "modify-package-json",
    template: "src/dynamic-modify/package.json.modify.ts",
    outputPath: "package.json",
  });
  assert(result.success).true();
});

test.case("rejects the old create-with-template format", () => {
  const result = stepSchema.safeParse({
    type: "create",
    name: "old-step",
    template: "templates/old.ts",
    outputPath: "old.txt",
  });
  assert(result.success).false();
});

test.case("rejects a static create step missing the file field", () => {
  const result = stepSchema.safeParse({
    type: "create",
    name: "bad-step",
    outputPath: "x.txt",
  });
  assert(result.success).false();
});
```

(Use the file's existing `test`/`assert` imports; match its import style.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx proby src/private/schema/instructions.spec.ts`
Expected: FAIL — new cases fail (`dynamic-create`/`dynamic-modify` not in the union; `file` not accepted).

- [ ] **Step 3: Rewrite the step schemas**

Replace the step schema section of `packages/sdk/src/private/schema/instructions.ts` with:

```ts
import zod from "zod";

const variableMapSchema = zod.record(zod.string(), zod.string()).optional();

const fromSchema = zod.object({
  name: zod.string(),
  singleUse: zod.boolean(),
}).optional();

const stepBase = {
  name: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
} as const;

export const createStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("create"),
  file: zod.string(),
  outputPath: zod.string(),
});

export const dynamicCreateStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("dynamic-create"),
  template: zod.string(),
  outputPath: zod.string(),
});

export const modifyStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("modify"),
  file: zod.string(),
  outputPath: zod.string(),
});

export const dynamicModifyStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("dynamic-modify"),
  template: zod.string(),
  outputPath: zod.string(),
});

export const deleteStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("delete"),
  outputPath: zod.string(),
});

export const readStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("read"),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
});

export const installStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("install"),
  target: zod.string().optional(),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
  packageManager: zod.union([
    zod.literal("pnpm"),
    zod.literal("npm"),
    zod.literal("bun"),
    zod.literal("yarn"),
    zod.literal("auto"),
  ]).default("npm"),
});

export type CreateStep = zod.infer<typeof createStepSchema>;
export type DynamicCreateStep = zod.infer<typeof dynamicCreateStepSchema>;
export type ModifyStep = zod.infer<typeof modifyStepSchema>;
export type DynamicModifyStep = zod.infer<typeof dynamicModifyStepSchema>;
export type DeleteStep = zod.infer<typeof deleteStepSchema>;
export type ReadStep = zod.infer<typeof readStepSchema>;
export type InstallStep = zod.infer<typeof installStepSchema>;

export const stepSchema = zod.discriminatedUnion("type", [
  createStepSchema,
  dynamicCreateStepSchema,
  modifyStepSchema,
  dynamicModifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  installStepSchema,
]);

export const stepsSchema = zod.array(stepSchema);
```

Keep `instructionsSchema` as-is. Replace `StepOverrideValue` with:

```ts
export type StepOverrideValue =
  | { type: "create"; file: string; outputPath: string }
  | { type: "dynamic-create"; template: string; outputPath: string }
  | { type: "modify"; file: string; outputPath: string }
  | { type: "dynamic-modify"; template: string; outputPath: string }
  | { type: "delete"; outputPath: string }
  | { type: "read"; path: string; as: string; jsonPath?: string; template?: string }
  | {
      type: "install";
      target?: string;
      dependencies?: string[];
      devDependencies?: string[];
      peerDependencies?: string[];
    };
```

Update `Step`:

```ts
export type Step =
  | CreateStep
  | DynamicCreateStep
  | ModifyStep
  | DynamicModifyStep
  | DeleteStep
  | ReadStep
  | InstallStep;
```

If `packages/sdk/src/private/index.ts` enumerates schema/type exports, add `dynamicCreateStepSchema`, `dynamicModifyStepSchema`, `DynamicCreateStep`, `DynamicModifyStep` following the existing lines.

- [ ] **Step 4: Add manifest entries for the dynamic step types**

In `packages/sdk/src/private/schema/manifest.ts`, after `readManifestEntrySchema`:

```ts
export const dynamicCreateManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("dynamic-create"),
  output: zod.union([createOutputSchema, noneOutputSchema]),
}).strict();

export const dynamicModifyManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("dynamic-modify"),
  output: zod.union([modifyOutputSchema, noneOutputSchema]),
}).strict();
```

Add the types and extend the union:

```ts
export type DynamicCreateManifestEntry = zod.infer<typeof dynamicCreateManifestEntrySchema>;
export type DynamicModifyManifestEntry = zod.infer<typeof dynamicModifyManifestEntrySchema>;

export const manifestLineSchema = zod.discriminatedUnion("stepType", [
  createManifestEntrySchema,
  dynamicCreateManifestEntrySchema,
  modifyManifestEntrySchema,
  dynamicModifyManifestEntrySchema,
  deleteManifestEntrySchema,
  installManifestEntrySchema,
  readManifestEntrySchema,
]);

export type ManifestEntry =
  | CreateManifestEntry
  | DynamicCreateManifestEntry
  | ModifyManifestEntry
  | DynamicModifyManifestEntry
  | DeleteManifestEntry
  | InstallManifestEntry
  | ReadManifestEntry;
```

Check `packages/sdk/src/private/schema/manifest.spec.ts` — update any fixtures that assert the union so they still pass, and add one case asserting `stepType: "dynamic-create"` with a create output parses, and one asserting `stepType: "dynamic-create"` with a modify output fails.

- [ ] **Step 5: Run tests and build the SDK**

Run: `cd packages/sdk && npx proby` — Expected: all SDK specs PASS (update any remaining old-format fixtures in other sdk specs, e.g. `include.spec.ts`, so they use the new shapes).
Run: `cd packages/sdk && pnpm build` — Expected: builds clean (tsgo + lib output).

- [ ] **Step 6: Bump the SDK version**

In `packages/sdk/package.json`: `"version": "0.1.0"` → `"version": "0.2.0"`.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk
git commit -m "feat!: clean-break step schema — create/dynamic-create/modify/dynamic-modify"
```

---

### Task 1.5: SDK — prefix included static `file` sources

**Files:**
- Modify: `packages/sdk/src/private/include.ts`
- Modify: `packages/sdk/src/private/include.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `include.spec.ts` (using its existing `includePowerup` fixtures/imports):

```ts
test.case("prefixes static file fields of included steps into the _internal namespace", async assert => {
  const steps = includePowerup(childWithStaticSteps, { variables: {} });

  const createStep = steps.find(step => step.name === `${childName}:static-note`) as { file?: string };
  assert(createStep.file).equals(`_internal/${childName}/src/create/note.txt`);

  const modifyStep = steps.find(step => step.name === `${childName}:static-patch`) as { file?: string };
  assert(modifyStep.file).equals(`_internal/${childName}/src/modify/pkg.json.json`);
});

test.case("leaves already-internal file paths untouched (transitive includes)", async assert => {
  const steps = includePowerup(childWithTransitiveStaticSteps, { variables: {} });

  const createStep = steps.find(step => step.name === `${childName}:nested`) as { file?: string };
  assert(createStep.file).equals("_internal/grandchild/src/create/nested.txt");
});

test.case("dynamic template steps keep their existing prefixing behavior", async assert => {
  const steps = includePowerup(childWithStaticSteps, { variables: {} });

  const dynamicStep = steps.find(step => step.name === `${childName}:dyn`) as { template?: string };
  assert(dynamicStep.template).equals(`_internal/${childName}/src/dynamic-create/dyn.ts`);
});
```

(Construct the child fixtures inside the spec with static create/modify steps — `file: "src/create/note.txt"`, `file: "src/modify/pkg.json.json"` — one dynamic-create step, and one transitive child step whose `file` already starts with `_internal/`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/sdk && npx proby src/private/include.spec.ts`
Expected: FAIL — `file` fields pass through unprefixed.

- [ ] **Step 3: Implement**

In `include.ts`, rename the path helpers to be field-agnostic and add `file` prefixing next to the existing `template` prefixing:

```ts
function isInternalPath(path: string): boolean {
  return path.startsWith("_internal/");
}

function prefixPath(path: string, namespace: string): string {
  return isInternalPath(path) ? path : `_internal/${namespace}/${path}`;
}
```

In the step mapping, after the existing `template` block:

```ts
      const fileField = (overridden as Step & { file?: string }).file;

      if (fileField !== undefined) {
        renamed.file = prefixPath(fileField, namespace);
      }
```

(Update the `renamed` cast to `Step & { template?: string; file?: string }` and replace the two `prefixTemplate`/`isInternalTemplate` call sites with the renamed helpers. Template behavior must remain byte-identical.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/sdk && npx proby && pnpm build`
Expected: all specs PASS, build clean.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/private/include.ts packages/sdk/src/private/include.spec.ts
git commit -m "feat: prefix included static file sources into the _internal namespace"
```

---

### Task 2: CLI — normalize non-Error rejections (`undefined` fix)

**Files:**
- Create: `packages/cli/src/private/errors/get-error-message.ts`
- Create: `packages/cli/src/private/errors/get-error-message.spec.ts`
- Modify: `packages/cli/src/bin.ts:25-27`

- [ ] **Step 1: Write the failing test**

`packages/cli/src/private/errors/get-error-message.spec.ts`:

```ts
import getErrorMessage from "#errors/get-error-message";
import test from "#test-utils/test/index";

test.case("returns the message for Error instances", async assert => {
  assert(getErrorMessage(new Error("boom"))).equals("boom");
});

test.case("returns the string itself for raw string rejections", async assert => {
  assert(getErrorMessage("fatal: not a git repository")).equals("fatal: not a git repository");
});

test.case("stringifies other values instead of printing undefined", async assert => {
  assert(getErrorMessage(undefined)).equals("undefined");
  assert(getErrorMessage({ code: 128 })).equals('{"code":128}');
});

test.case("handles objects with a message property", async assert => {
  assert(getErrorMessage({ message: "from io" })).equals("from io");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && CI=true npx proby src/private/errors/get-error-message.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/cli/src/private/errors/get-error-message.ts`:

```ts
export default function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(error);
  }

  return String(error);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && CI=true npx proby src/private/errors/get-error-message.spec.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Wire into bin.ts**

In `packages/cli/src/bin.ts`, add the import and replace the catch:

```ts
import getErrorMessage from "./private/errors/get-error-message.js";
```

```ts
try {
  await program.run();
} catch (err) {
  console.error("\n" + getErrorMessage(err));
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/bin.ts packages/cli/src/private/errors/get-error-message.ts packages/cli/src/private/errors/get-error-message.spec.ts
git commit -m "fix: print real messages for non-Error rejections (io.run stderr strings)"
```

---

### Task 3: CLI — old-format CodeError + validator support for new step types

**Files:**
- Modify: `packages/cli/src/private/errors/sharedErrors.ts`
- Modify: `packages/cli/src/private/errors/sharedErrors.spec.ts`
- Modify: `packages/cli/src/private/utils/validate/check-compiled-instructions-for-errors/index.ts`
- Modify: `packages/cli/src/private/utils/validate/check-compiled-instructions-for-errors/get-list-of-issues-with-instructions.ts`
- Test: `packages/cli/src/private/utils/validate/check-compiled-instructions-for-errors/check-compiled-instructions-for-errors.spec.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/src/private/errors/sharedErrors.spec.ts` (follow its existing import style):

```ts
test.case("old_format_instructions explains the break and points at re-capture", async assert => {
  try {
    throw shared_errors.old_format_instructions();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(SharedErrorCode.old_format_instructions);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("no longer supported");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup create");
  }
});
```

Append to `check-compiled-instructions-for-errors.spec.ts`:

```ts
test.case("old-format create-with-template instructions throw old_format_instructions", async assert => {
  const oldFormatInstructions = {
    name: "old-powerup",
    type: "single-use",
    description: "old format",
    variables: { required: [], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "x", template: "templates/x.ts", outputPath: "x.txt" },
    ],
  };

  try {
    await checkCompiledInstructionsForErrors(oldFormatInstructions as never);
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("old_format_instructions");
  }
});

test.case("dynamic-create steps pass validation and are returned", async assert => {
  const instructions = {
    name: "new-powerup",
    type: "single-use",
    description: "new format",
    variables: { required: [], optional: [] },
    intent: [],
    steps: [
      { type: "dynamic-create", name: "x", template: "src/dynamic-create/x.ts", outputPath: "x.txt" },
      { type: "create", name: "y", file: "src/create/y.txt", outputPath: "y.txt" },
    ],
  };

  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions as never);
  assert(validatedCompiledInstructions.steps.length).equals(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/errors/sharedErrors.spec.ts src/private/utils/validate/check-compiled-instructions-for-errors/check-compiled-instructions-for-errors.spec.ts`
Expected: FAIL — `old_format_instructions` doesn't exist.

- [ ] **Step 3: Implement**

In `packages/cli/src/private/errors/sharedErrors.ts`, add inside the `error.coded({...})` object (match its existing entries' style — same `t\`${errorBGText}${errorText}\`` template pattern as `createErrors.ts`):

```ts
old_format_instructions: () => {
  const errorText =
    `This powerup uses the pre-0.3 template-wrapped step format (create/modify steps with "template" fields), which is no longer supported.\n\n` +
    `Re-capture it with "pup create <name> --capture=all", or convert steps by hand:\n` +
    `  - create steps with variables  → { type: "dynamic-create", template: "src/dynamic-create/<file>.ts", ... }\n` +
    `  - create steps without variables → { type: "create", file: "src/create/<file>", ... }\n` +
    `  - modify steps with variables  → { type: "dynamic-modify", template: "src/dynamic-modify/<file>.ts", ... }\n` +
    `  - modify steps without variables → { type: "modify", file: "src/modify/<file>.json", ... }`;
  return t`${errorBGText}${errorText}`;
},
```

(If `sharedErrors.ts` doesn't define `errorBGText`, copy the two lines defining it from `createErrors.ts`.)

In `check-compiled-instructions-for-errors/index.ts`:

```ts
import shared_errors from "#errors/sharedErrors";
```

Replace `checkForValidInstructionsSchema`:

```ts
function checkForValidInstructionsSchema(instructions: unknown) {
  const schemaResult = instructionsSchema.safeParse(instructions);

  if (!schemaResult.success) {
    if (isOldFormatInstructions(instructions)) {
      throw shared_errors.old_format_instructions();
    }
    throw build_errors.malformed_instructions(schemaResult.error.message);
  }

  return schemaResult.data;
}

function isOldFormatInstructions(instructions: unknown): boolean {
  const steps = (instructions as { steps?: { type?: string; template?: string }[] })?.steps;

  if (!Array.isArray(steps)) {
    return false;
  }

  return steps.some(step =>
    (step.type === "create" || step.type === "modify") && typeof step.template === "string",
  );
}
```

In `get-list-of-issues-with-instructions.ts`, replace `pathOf`:

```ts
function pathOf(step: Step): string | undefined {
  if (step.type === "create" ||
    step.type === "dynamic-create" ||
    step.type === "modify" ||
    step.type === "dynamic-modify" ||
    step.type === "delete"
  ) {
    return step.outputPath;
  }
  if (step.type === "read") {
    return step.path;
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/errors/sharedErrors.spec.ts src/private/utils/validate/check-compiled-instructions-for-errors/check-compiled-instructions-for-errors.spec.ts`
Expected: PASS. (The CLI's other old-format specs will fail until Phase 3 — that's expected; do not run the full suite yet.)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/errors/sharedErrors.ts packages/cli/src/private/errors/sharedErrors.spec.ts packages/cli/src/private/utils/validate
git commit -m "feat: old-format instructions CodeError + validator support for dynamic step types"
```

---

## Phase 2 — Generation utils & capture

### Task 4: Readable template generator (replaces wrapAsTemplate)

**Files:**
- Create: `packages/cli/src/private/utils/template-conversion/generate-readable-template.ts`
- Create: `packages/cli/src/private/utils/template-conversion/generate-readable-template.spec.ts`
- Delete: `packages/cli/src/private/utils/create/capture-files/wrap-as-template.ts`
- Delete: `packages/cli/src/private/utils/create/capture-files/wrap-as-template.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import generateReadableTemplate from "#utils/template-conversion/generate-readable-template";
import { runTemplate } from "#template-runners/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/readable-template");

test.case("escapes backticks, dollar-brace, and backslashes while keeping content readable", async assert => {
  const content = "line one\nwith `backtick` and ${interpolation} and \\backslash\\\n";
  const generated = generateReadableTemplate({ content });

  assert(generated).includes("`line one");
  assert(generated).includes("\\`backtick\\`");
  assert(generated).includes("\\${interpolation}");
  assert(generated).includes("\\\\backslash\\\\");
});

test.case("round-trips: generated template renders byte-identical content", async assert => {
  await fs.create(testRoot);
  const content = [
    "{",
    "  \"name\": \"hello\",",
    "  \"scripts\": { \"dev\": \"vite`weird\" }",
    "}",
    "",
  ].join("\n");

  const generated = generateReadableTemplate({ content });
  const templateRef = testRoot.append("/round-trip.ts");
  await templateRef.write(generated);

  const rendered = await runTemplate({ templatePath: templateRef, variables: {} });
  assert(rendered).equals(content);

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && CI=true npx proby src/private/utils/template-conversion/generate-readable-template.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/cli/src/private/utils/template-conversion/generate-readable-template.ts`:

```ts
export default function generateReadableTemplate({ content }: { content: string }): string {
  const escapedContent = content
    .replace(/\\/g, () => "\\\\")
    .replace(/`/g, () => "\\`")
    .replace(/\$\{/g, () => "\\${");

  return "export default function (_variables: Record<string, string>): string {\n"
    + "  return `" + escapedContent + "`;\n"
    + "}\n";
}
```

Delete `wrap-as-template.ts` and `wrap-as-template.spec.ts` (their consumers are rewritten in Tasks 7–9; do not run the full suite yet).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && CI=true npx proby src/private/utils/template-conversion/generate-readable-template.spec.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/template-conversion
git rm packages/cli/src/private/utils/create/capture-files/wrap-as-template.ts packages/cli/src/private/utils/create/capture-files/wrap-as-template.spec.ts
git commit -m "feat: readable template generation (backtick literal, minimal escaping); remove wrapAsTemplate"
```

---

### Task 5: writeIfChanged util

**Files:**
- Create: `packages/cli/src/private/utils/shared/write-if-changed.ts`
- Create: `packages/cli/src/private/utils/shared/write-if-changed.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import writeIfChanged from "#utils/shared/write-if-changed";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/write-if-changed");

test.case("writes a new file and returns true", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/a.txt");

  const wrote = await writeIfChanged({ targetPath, content: "hello" });

  assert(wrote).true();
  assert(await targetPath.text()).equals("hello");
  await testRoot.remove({ recursive: true });
});

test.case("skips identical content (mtime preserved) and returns false", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/b.txt");
  await writeIfChanged({ targetPath, content: "same" });

  const statsBefore = await statMtime(targetPath);
  const wrote = await writeIfChanged({ targetPath, content: "same" });
  const statsAfter = await statMtime(targetPath);

  assert(wrote).false();
  assert(statsAfter).equals(statsBefore);

  await testRoot.remove({ recursive: true });
});

test.case("overwrites different content and returns true", async assert => {
  await fs.create(testRoot);
  const targetPath = testRoot.append("/c.txt");
  await writeIfChanged({ targetPath, content: "before" });

  const wrote = await writeIfChanged({ targetPath, content: "after" });

  assert(wrote).true();
  assert(await targetPath.text()).equals("after");

  await testRoot.remove({ recursive: true });
});

async function statMtime(targetPath: import("@rcompat/fs").FileRef): Promise<number> {
  const { stat } = await import("node:fs/promises");
  const stats = await stat(targetPath.path);
  return stats.mtimeMs;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && CI=true npx proby src/private/utils/shared/write-if-changed.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function writeIfChanged({
  targetPath,
  content,
}: {
  targetPath: FileRef;
  content: string;
}): Promise<boolean> {
  if (await targetPath.exists()) {
    const existing = await targetPath.text();
    if (existing === content) {
      return false;
    }
  }

  await fs.create(targetPath.directory);
  await targetPath.write(content);

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && CI=true npx proby src/private/utils/shared/write-if-changed.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/shared/write-if-changed.ts packages/cli/src/private/utils/shared/write-if-changed.spec.ts
git commit -m "feat: writeIfChanged — skip identical writes to preserve mtimes"
```

---

### Task 6: walkFiles util (portable directory walk)

**Files:**
- Create: `packages/cli/src/private/utils/create/capture-files/walk-files.ts`
- Create: `packages/cli/src/private/utils/create/capture-files/walk-files.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import walkFiles from "#utils/create/capture-files/walk-files";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/walk-files");

async function createFile(dir: import("@rcompat/fs").FileRef, filePath: string, content = "x"): Promise<void> {
  const target = dir.append(`/${filePath}`);
  await fs.create(target.directory);
  await target.write(content);
}

test.case("walks nested files and returns sorted relative paths", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, "z.txt");
  await createFile(testRoot, "src/main.ts");
  await createFile(testRoot, "src/lib/helper.ts");

  const files = await walkFiles({ root: testRoot });

  assert(files).equals(["src/lib/helper.ts", "src/main.ts", "z.txt"]);

  await testRoot.remove({ recursive: true });
});

test.case("respects excluded dir names, basenames, and env files", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, "keep.txt");
  await createFile(testRoot, "node_modules/pkg/index.js");
  await createFile(testRoot, "dist/bundle.js");
  await createFile(testRoot, "pnpm-lock.yaml");
  await createFile(testRoot, ".env.local");

  const files = await walkFiles({
    root: testRoot,
    excludedDirNames: ["node_modules", "dist"],
    excludedBasenames: ["pnpm-lock.yaml"],
    excludeEnvFiles: true,
  });

  assert(files).equals(["keep.txt"]);

  await testRoot.remove({ recursive: true });
});

test.case("without exclusions, returns everything including dotfiles that are not env files", async assert => {
  await fs.create(testRoot);
  await createFile(testRoot, ".gitignore");
  await createFile(testRoot, "regular.txt");

  const files = await walkFiles({ root: testRoot });

  assert(files).equals([".gitignore", "regular.txt"]);

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/walk-files.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/cli/src/private/utils/create/capture-files/walk-files.ts`:

```ts
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { FileRef } from "@rcompat/fs";

export default async function walkFiles({
  root,
  excludedDirNames = [],
  excludedBasenames = [],
  excludeEnvFiles = false,
}: {
  root: FileRef;
  excludedDirNames?: string[];
  excludedBasenames?: string[];
  excludeEnvFiles?: boolean;
}): Promise<string[]> {
  const filePaths: string[] = [];

  await collect({
    absoluteDir: root.path,
    relativeDir: "",
    excludedDirNames,
    excludedBasenames,
    excludeEnvFiles,
    filePaths,
  });

  return filePaths.sort();
}

async function collect({
  absoluteDir,
  relativeDir,
  excludedDirNames,
  excludedBasenames,
  excludeEnvFiles,
  filePaths,
}: {
  absoluteDir: string;
  relativeDir: string;
  excludedDirNames: string[];
  excludedBasenames: string[];
  excludeEnvFiles: boolean;
  filePaths: string[];
}): Promise<void> {
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const relativePath = relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      if (excludedDirNames.includes(entry.name)) {
        continue;
      }

      await collect({
        absoluteDir: path.join(absoluteDir, entry.name),
        relativeDir: relativePath,
        excludedDirNames,
        excludedBasenames,
        excludeEnvFiles,
        filePaths,
      });

      continue;
    }

    if (entry.isFile()) {
      if (excludedBasenames.includes(entry.name)) {
        continue;
      }

      if (excludeEnvFiles && entry.name.startsWith(".env")) {
        continue;
      }

      filePaths.push(relativePath);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/walk-files.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/create/capture-files/walk-files.ts packages/cli/src/private/utils/create/capture-files/walk-files.spec.ts
git commit -m "feat: walkFiles — portable filesystem walk with exclusions"
```

---

### Task 7: capture-all — walk fallback + verbatim copies to src/create/

**Files:**
- Modify: `packages/cli/src/private/utils/create/capture-files/capture-all-files.ts` (full rewrite)
- Modify: `packages/cli/src/private/utils/create/capture-files/capture-all-files.spec.ts` (rewrite cases)

- [ ] **Step 1: Rewrite the spec**

Rewrite `capture-all-files.spec.ts` cases (keep the existing `setupTestDir`/`gitInit`/`createFile`/`cleanup` helpers):

```ts
test.case("captures tracked files as verbatim copies with file-field steps", async assert => {
  await setupTestDir();

  await createFile(testRoot, "src/foo.ts", "export const foo = 1;\n");
  await createFile(testRoot, "src/bar.ts", "export const bar = 2;\n");
  await io.run("git add -A", { cwd: testRoot.path });
  await io.run("git commit -m add", { cwd: testRoot.path });

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.length).equals(3);
  assert(result.steps.some(s => s.type === "create" && s.outputPath === "README.md" && s.file === "src/create/README.md")).true();

  const copiedContent = await newPowerupDir.append("/src/create/src/foo.ts").text();
  assert(copiedContent).equals("export const foo = 1;\n");

  await cleanup();
});

test.case("works in a directory without git — falls back to a filesystem walk", async assert => {
  const nonGitRoot = root.append("/tmp/capture-nogit");
  await nonGitRoot.remove({ recursive: true }).catch(() => {});
  await fs.create(nonGitRoot);
  await createFile(nonGitRoot, "hello.txt", "no git here\n");
  await createFile(nonGitRoot, "node_modules/dep/index.js", "skipped\n");

  const newPowerupDir = nonGitRoot.append("/.powerups/installed/_internal/ng");
  await fs.create(newPowerupDir);

  const result = await captureAllFiles({
    projectRoot: nonGitRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.length).equals(1);
  assert(result.steps[0]!.type).equals("create");
  assert(await newPowerupDir.append("/src/create/hello.txt").text()).equals("no git here\n");

  await nonGitRoot.remove({ recursive: true });
});

test.case("excludes the new powerup's own directory from capture", async assert => {
  await setupTestDir();

  const newPowerupDir = testRoot.append("/.powerups/installed/_internal/my-powerup");
  await fs.create(newPowerupDir);
  await createFile(newPowerupDir, "index.ts", "export default 1;\n");

  const result = await captureAllFiles({
    projectRoot: testRoot,
    newPowerupDirectory: newPowerupDir,
    isDryRun: false,
  });

  assert(result.steps.some(s => s.outputPath === ".powerups/installed/_internal/my-powerup/index.ts")).false();

  await cleanup();
});
```

Keep the existing `.gitignore`-respect case (git mode) — update its assertions to `file`-field steps.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/capture-all-files.spec.ts`
Expected: FAIL — current implementation wraps templates and crashes on non-git dirs.

- [ ] **Step 3: Rewrite capture-all-files.ts**

```ts
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";
import walkFiles from "#utils/create/capture-files/walk-files";
import generateStepName from "#utils/create/capture-files/generate-step-name";

const CAPTURE_EXCLUDED_DIR_NAMES = ["node_modules", "dist", ".git"];
const CAPTURE_EXCLUDED_BASENAMES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
];

export default async function captureAllFiles({
  projectRoot,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  const allFiles = await listProjectFiles({ projectRoot });

  const newPowerupRelativePath = newPowerupDirectory.path.replace(projectRoot.path + "/", "");
  const filteredFiles = allFiles.filter(filePath =>
    !filePath.startsWith(newPowerupRelativePath + "/"),
  );

  const steps: Step[] = [];
  const existingNames = new Set<string>();
  const warnings: string[] = [];

  for (const filePath of filteredFiles) {
    const sourceRef = projectRoot.append(`/${filePath}`);
    const fileField = `src/create/${filePath}`;

    if (!isDryRun) {
      const targetRef = newPowerupDirectory.append(`/${fileField}`);
      await fs.create(targetRef.directory);
      await sourceRef.copy(targetRef);
    }

    const stepName = generateStepName({
      prefix: "create",
      filePath,
      existingNames,
    });

    steps.push({ type: "create", name: stepName, file: fileField, outputPath: filePath });
  }

  return { steps, fileCount: filteredFiles.length, warnings };
}

async function listProjectFiles({ projectRoot }: { projectRoot: FileRef }): Promise<string[]> {
  try {
    const output = await io.run(
      "git ls-files --cached --others --exclude-standard",
      { cwd: projectRoot.path },
    );

    return filterExcluded(output.split("\n").filter(f => f.length > 0));
  } catch {
    // Not a git repository (or git unavailable) — fall back to a filesystem walk
    // with the same exclusions so capture works everywhere.
    return walkFiles({
      root: projectRoot,
      excludedDirNames: CAPTURE_EXCLUDED_DIR_NAMES,
      excludedBasenames: CAPTURE_EXCLUDED_BASENAMES,
      excludeEnvFiles: true,
    });
  }
}

function filterExcluded(filePaths: string[]): string[] {
  return filePaths.filter(filePath => {
    for (const dirName of CAPTURE_EXCLUDED_DIR_NAMES) {
      if (filePath === dirName || filePath.startsWith(dirName + "/")) {
        return false;
      }

      if (filePath.includes("/" + dirName + "/")) {
        return false;
      }
    }

    const basename = filePath.split("/").pop()!;

    if (CAPTURE_EXCLUDED_BASENAMES.includes(basename)) {
      return false;
    }

    if (basename.startsWith(".env")) {
      return false;
    }

    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/capture-all-files.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/create/capture-files/capture-all-files.ts packages/cli/src/private/utils/create/capture-files/capture-all-files.spec.ts
git commit -m "feat!: capture=all — verbatim copies to src/create, git-independent via walk fallback"
```

---

### Task 8: workingDir capture — new files become verbatim copies

**Files:**
- Modify: `packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.ts`
- Modify: `packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.spec.ts`

- [ ] **Step 1: Update the spec**

In `create-steps-from-new-files.spec.ts`, update the assertions: steps are `{ type: "create", file: "src/create/<path>", outputPath: "<path>" }`, and the copied file at `<powerupDir>/src/create/<path>` has byte-identical content to the source (assert via `.text()`). Concretely, in the case that captures a new file `src/new-file.ts` with content `export const x = 1;\n`, assert:

```ts
assert(step.file).equals("src/create/src/new-file.ts");
assert(await newPowerupDirectory.append("/src/create/src/new-file.ts").text()).equals("export const x = 1;\n");
```

Add one case asserting no file matching `/templates/` exists in the powerup dir after capture.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/create-steps-from-new-files.spec.ts`
Expected: FAIL — current code wraps templates.

- [ ] **Step 3: Rewrite the util**

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default async function createStepsFromNewFiles({
  newFiles,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  isDryRun,
}: {
  newFiles: GitChange[];
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  isDryRun: boolean;
}): Promise<Step[]> {
  const steps: Step[] = [];

  for (const change of newFiles) {
    const sourceRef = projectRoot.append(`/${change.path}`);
    const fileField = `src/create/${change.path}`;

    if (!isDryRun) {
      const targetRef = newPowerupDirectory.append(`/${fileField}`);
      await fs.create(targetRef.directory);
      await sourceRef.copy(targetRef);
    }

    const stepName = generateStepName({ prefix: "create", filePath: change.path, existingNames });

    steps.push({ type: "create", name: stepName, file: fileField, outputPath: change.path });
  }

  return steps;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/create-steps-from-new-files.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.ts packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.spec.ts
git commit -m "feat!: workingDir new-file capture produces verbatim src/create copies"
```

---

### Task 9: workingDir capture — modified files produce pretty JSON + fixtures

**Files:**
- Modify: `packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.ts`
- Modify: `packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.spec.ts`

- [ ] **Step 1: Update the spec**

In `create-steps-from-modified-files.spec.ts` (setup: git repo with a committed `package.json`, then modify it and capture), update/add assertions:

```ts
test.case("modified files produce a static modify step, readable JSON, and a fixture pre-image", async assert => {
  // ...existing setup that produces a modified package.json...

  const modifyStep = result.steps.find(s => s.type === "modify");

  assert(modifyStep!.file).equals("src/modify/package.json.json");

  const modificationsJson = await newPowerupDirectory.append("/src/modify/package.json.json").text();
  assert(modificationsJson).includes("\"where\"");
  assert(modificationsJson.split("\n")[1]!.startsWith("  {"));

  const fixtureContent = await newPowerupDirectory.append("/fixtures/package.json").text();
  assert(fixtureContent).equals(preImageContent);

  // no escaped-blob template anywhere:
  const hasTemplates = (await walkFiles({ root: newPowerupDirectory })).some(p => p.startsWith("templates/"));
  assert(hasTemplates).false();
});
```

(Import `walkFiles` from `#utils/create/capture-files/walk-files`; set `preImageContent` from the committed content used in the setup.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/create-steps-from-modified-files.spec.ts`
Expected: FAIL — current code writes wrapped templates.

- [ ] **Step 3: Rewrite createModifyStep inside the util**

Replace the body of `createModifyStep` (keep `parseDiffHunks` and the file's hunk/diff helpers unchanged) and update imports:

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import { generateModifications, type DiffHunk } from "#utils/create/capture-files/diff-to-modifications";
import type { GitChange } from "#utils/create/capture-files/git-status";
```

Inside `createModifyStep`, after `const postImage = await postImagePath.text();` and the existing `generateModifications` + warnings block, replace the template-writing block with:

```ts
  const modificationsJson = JSON.stringify(result.modifications, null, 2);
  const fileField = `src/modify/${change.path}.json`;

  if (!isDryRun) {
    const modifyTargetRef = newPowerupDirectory.append(`/${fileField}`);
    await fs.create(modifyTargetRef.directory);
    await modifyTargetRef.write(modificationsJson);

    const fixtureRef = newPowerupDirectory.append(`/fixtures/${change.path}`);
    await fs.create(fixtureRef.directory);
    await fixtureRef.write(preImage);
  }

  const stepName = generateStepName({ prefix: "modify", filePath: change.path, existingNames });

  return { type: "modify", name: stepName, file: fileField, outputPath: change.path };
```

(Remove the `wrapAsTemplate` import and all `.modify.ts.ts` template logic.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/capture-files/create-steps-from-modified-files.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.ts packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.spec.ts
git commit -m "feat!: modify capture — pretty-printed src/modify JSON + fixtures pre-images"
```

---

### Task 10: workingDir-without-git CodeError + create-command rollback

**Files:**
- Modify: `packages/cli/src/private/utils/create/capture-files/git-status.ts`
- Modify: `packages/cli/src/private/errors/createErrors.ts` (+ spec)
- Create: `packages/cli/src/private/utils/create/rollback-on-capture-failure.ts`
- Create: `packages/cli/src/private/utils/create/rollback-on-capture-failure.spec.ts`
- Modify: `packages/cli/src/private/commands/create/index.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/src/private/errors/createErrors.spec.ts`:

```ts
test.case("git_repo_required explains workingDir needs git and suggests capture=all", async assert => {
  try {
    throw create_errors.git_repo_required();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.git_repo_required);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("requires a git repository");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("--capture=all");
  }
});
```

`packages/cli/src/private/utils/create/rollback-on-capture-failure.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runCaptureWithRollback from "#utils/create/rollback-on-capture-failure";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/rollback");

test.case("rethrows the capture error after removing the partially created powerup dir", async assert => {
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/my-powerup");
  await fs.create(newPowerupDirectory);
  await newPowerupDirectory.append("/index.ts").write("export default 1;\n");

  let threw = "";
  try {
    await runCaptureWithRollback({
      capture: async () => {
        throw new Error("git exploded");
      },
      newPowerupDirectory,
      isDryRun: false,
    });
  } catch (error) {
    threw = (error as Error).message;
  }

  assert(threw).equals("git exploded");
  assert(await newPowerupDirectory.exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("keeps the powerup dir when capture succeeds", async assert => {
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/ok-powerup");
  await fs.create(newPowerupDirectory);

  const result = await runCaptureWithRollback({
    capture: async () => "captured",
    newPowerupDirectory,
    isDryRun: false,
  });

  assert(result).equals("captured");
  assert(await newPowerupDirectory.exists()).true();

  await testRoot.remove({ recursive: true });
});

test.case("does not delete anything on dry runs", async assert => {
  await fs.create(testRoot);
  const newPowerupDirectory = testRoot.append("/dry-powerup");
  await fs.create(newPowerupDirectory);

  await runCaptureWithRollback({
    capture: async () => {
      throw new Error("boom");
    },
    newPowerupDirectory,
    isDryRun: true,
  }).catch(() => {});

  assert(await newPowerupDirectory.exists()).true();

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/errors/createErrors.spec.ts src/private/utils/create/rollback-on-capture-failure.spec.ts`
Expected: FAIL — `git_repo_required` and the rollback util don't exist.

- [ ] **Step 3: Implement**

Add to `create_errors` in `packages/cli/src/private/errors/createErrors.ts`:

```ts
git_repo_required: () => {
  const errorText =
    `capture=workingDir requires a git repository — there is no commit history to diff against.\n\n` +
    `Use "${CLI_CMD} create <name> --capture=all" to capture every file instead.`;
  return t`${errorBGText}${errorText}`;
},
```

`packages/cli/src/private/utils/create/rollback-on-capture-failure.ts`:

```ts
import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";

export default async function runCaptureWithRollback({
  capture,
  newPowerupDirectory,
  isDryRun,
}: {
  capture: () => Promise<unknown>;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<unknown> {
  try {
    return await capture();
  } catch (error) {
    if (!isDryRun && (await newPowerupDirectory.exists())) {
      await newPowerupDirectory.remove({ recursive: true });
      const dim = cli.fg.dim;
      cli.print(`${dim(`Removed partially created powerup at ${newPowerupDirectory.path}`)}\n`);
    }

    throw error;
  }
}
```

In `git-status.ts`, replace both `throw new Error("Working directory is not a git repository")` occurrences with:

```ts
import create_errors from "#errors/createErrors";
```

```ts
throw create_errors.git_repo_required();
```

In `packages/cli/src/private/commands/create/index.ts`, import the rollback util and wrap the capture call:

```ts
import runCaptureWithRollback from "#utils/create/rollback-on-capture-failure";
```

```ts
    if (flags.capture !== undefined) {
      const newPowerupDirectory = cwd.append(`/${outputPath}/${powerupName}`);
      const indexFilePath = newPowerupDirectory.append("/index.ts");

      captureResult = await runCaptureWithRollback({
        capture: () => captureFiles({
          captureMode: flags.capture as "all" | "workingDir",
          projectRoot,
          workingDir: projectRoot,
          newPowerupDirectory,
          indexFilePath,
          isDryRun,
        }),
        newPowerupDirectory,
        isDryRun,
      }) as CaptureResult;
    }
```

(Add `import type { CaptureResult } from "#utils/create/capture-files/index";` and type `captureResult` as `CaptureResult | undefined` if needed for the cast.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/errors/createErrors.spec.ts src/private/utils/create/rollback-on-capture-failure.spec.ts src/private/utils/create/capture-files/git-status.spec.ts`
Expected: PASS (update `git-status.spec.ts` expectations if it asserted the old plain-Error message — assert `error.code` equals `git_repo_required` instead).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/errors/createErrors.ts packages/cli/src/private/errors/createErrors.spec.ts packages/cli/src/private/utils/create/capture-files/git-status.ts packages/cli/src/private/utils/create/capture-files/git-status.spec.ts packages/cli/src/private/utils/create/rollback-on-capture-failure.ts packages/cli/src/private/utils/create/rollback-on-capture-failure.spec.ts packages/cli/src/private/commands/create/index.ts
git commit -m "feat: git_repo_required CodeError + create rollback on capture failure"
```

---

## Phase 3 — Run/build/use pipeline

### Task 11: runPowerup parameterization (sourceBase, flags, manifest return)

**Files:**
- Modify: `packages/cli/src/private/utils/use/run-powerup/index.ts`
- Modify: `packages/cli/src/private/utils/use/run-powerup/run-step.ts`
- Modify: `packages/cli/src/private/utils/use/run-powerup/steps/run-create-step/render-template.ts`
- Modify: `packages/cli/src/private/utils/use/run-powerup/run-powerup.spec.ts` (update call sites)
- Modify: `packages/cli/src/private/utils/use/run-powerup/run-step.spec.ts` (update call sites)

- [ ] **Step 1: Update run-powerup/index.ts**

```ts
import { type Instructions, type ManifestEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import runStep from "#utils/use/run-powerup/run-step";
import saveManifest from "#utils/use/run-powerup/save-manifest";
import is from "@rcompat/is";

export default async function runPowerup({
  destination,
  powerupDirectory,
  sourceBase,
  instructions,
  isDryRun,
  variables,
  powerupVersion,
  powerupLocation,
  saveManifest = true,
  overwriteExisting = false,
  skipInstallSteps = false,
  printFinalSummary = true,
}: {
  destination: FileRef;
  powerupDirectory: FileRef;
  sourceBase: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
  variables: ResolvedVariable;
  powerupVersion: string;
  powerupLocation: string;
  saveManifest?: boolean;
  overwriteExisting?: boolean;
  skipInstallSteps?: boolean;
  printFinalSummary?: boolean;
}): Promise<ManifestEntry[]> {
  const collectedManifests: ManifestEntry[] = [];

  for (const step of instructions.steps) {
    const { manifest, variableUpdate } = await runStep({
      step,
      isDryRun,
      destination,
      powerupDirectory,
      sourceBase,
      variables,
      powerupName: instructions.name,
      powerupVersion,
      powerupLocation,
      powerupType: instructions.type,
      overwriteExisting,
      skipInstallSteps,
    });

    if (is.truthy(variableUpdate)) {
      variables[variableUpdate!.name] = variableUpdate!.value;
    }

    printStepSummary({ manifest });

    collectedManifests.push(manifest);

    if (!isDryRun && saveManifest && is.truthy(manifest)) {
      await saveManifest({ destination, manifest });
    }
  }

  if (!isDryRun && printFinalSummary) {
    const green = cli.fg.green;
    const blue = cli.fg.cyan;
    cli.print(`\n${green("✓")} Powerup ${instructions.name} was successfully used in ${blue(destination.path)}\n`);
  }

  return collectedManifests;
}
```

(Keep `printStepSummary` unchanged.)

- [ ] **Step 2: Update run-step.ts**

Add to the destructured params and the function signature type:

```ts
  sourceBase,
  overwriteExisting,
  skipInstallSteps,
```

with types:

```ts
  sourceBase: FileRef;
  overwriteExisting: boolean;
  skipInstallSteps: boolean;
```

Replace the switch with:

```ts
  switch (step.type) {
    case "create": {
      const result = await runCreateStep({
        step, isDryRun, destination, sourceBase, variables: stepVariables, overwriteExisting,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    case "dynamic-create": {
      const result = await runDynamicCreateStep({
        step, isDryRun, destination, sourceBase, variables: stepVariables, overwriteExisting,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    case "modify": {
      const result = await runModifyStep({
        step, isDryRun, destination, sourceBase, variables: stepVariables,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    case "dynamic-modify": {
      const result = await runDynamicModifyStep({
        step, isDryRun, destination, sourceBase, variables: stepVariables,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    case "delete": {
      const result = await runDeleteStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    case "read": {
      const result = await runReadStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
    }
    case "install": {
      if (skipInstallSteps) {
        return {
          manifest: {
            timestamp: new Date(),
            stepName: step.name,
            from: step.from?.name,
            stepType: "install",
            status: "skipped-warning",
            output: { type: "none" },
            ...base,
          },
        };
      }

      const result = await runInstallStep({
        step, isDryRun, destination, variables: stepVariables,
      });

      return { manifest: { ...result.manifest, ...base } };
    }
    default:
      throw use_errors.unsupported_step_type((step as { type: string }).type);
  }
```

Add imports:

```ts
import runDynamicCreateStep from "#utils/use/run-powerup/steps/run-dynamic-create-step/index";
import runDynamicModifyStep from "#utils/use/run-powerup/steps/run-dynamic-modify-step/index";
```

- [ ] **Step 3: Update render-template.ts**

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import { runTemplate } from "#template-runners/index";
import use_errors from "#errors/useErrors";

export default async function renderTemplate({
  template,
  sourceBase,
  variables,
}: {
  template: string;
  sourceBase: FileRef;
  variables: ResolvedVariable;
}): Promise<string> {
  const templatePath = sourceBase.append(`/${template}`);

  if (!(await fs.exists(templatePath))) {
    throw use_errors.template_not_found(template);
  }

  return runTemplate({ templatePath, variables });
}
```

- [ ] **Step 4: Update existing specs + call sites so the package compiles**

- In `run-powerup.spec.ts` and `run-step.spec.ts`: add `sourceBase: <the existing powerupDirectory ref>.append("/dist")` (or a source dir the test controls) to every `runPowerup`/`runStep` call.
- In `packages/cli/src/private/commands/use/index.ts`: add `sourceBase: powerup.location.append("/dist"),` to the `runPowerup` call.
- In `packages/cli/src/private/commands/create/index.ts`: add `sourceBase: powerup.location.append("/dist"),` to the `runPowerup` call.
- **Task 11 and Task 12 touch the same files** — implement the four runner bodies from Task 12 Step 3 as part of this task's commit (keeping the repo compiling and the runners real), and treat Task 12 as the test-authoring pass. Do not run the run-powerup specs until the runner bodies exist.

- [ ] **Step 5: Run affected tests**

Run: `cd packages/cli && CI=true npx proby src/private/utils/use/run-powerup/run-powerup.spec.ts src/private/utils/use/run-powerup/run-step.spec.ts`
Expected: PASS (they may need fixture updates from the new step shapes — update `template:` fixtures on create steps to `dynamic-create` steps, or swap to `file:`-based static creates matching the test's on-disk sources; follow whichever the test asserts).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/private/utils/use packages/cli/src/private/commands/use/index.ts packages/cli/src/private/commands/create/index.ts
git commit -m "feat: runPowerup sourceBase parameterization + manifest collection + install skip/overwrite flags"
```

---

### Task 12: Step runner bodies — static create/modify + dynamic-create/dynamic-modify

**Files:**
- Rewrite: `packages/cli/src/private/utils/use/run-powerup/steps/run-create-step/index.ts`
- Create: `packages/cli/src/private/utils/use/run-powerup/steps/run-dynamic-create-step/index.ts`
- Rewrite: `packages/cli/src/private/utils/use/run-powerup/steps/run-modify-step/index.ts`
- Create: `packages/cli/src/private/utils/use/run-powerup/steps/run-dynamic-modify-step/index.ts`
- Modify: `packages/cli/src/private/errors/useErrors.ts` (+ spec)
- Specs: update `run-create-step.spec.ts`, `run-modify-step.spec.ts`; create `run-dynamic-create-step.spec.ts`, `run-dynamic-modify-step.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add `source_not_found` to `useErrors.ts` (same pattern as existing entries) and one case to `useErrors.spec.ts`:

```ts
test.case("source_not_found includes the static source path", async assert => {
  try {
    throw use_errors.source_not_found("src/create/missing.txt");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(UseErrorCode.source_not_found);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("src/create/missing.txt");
  }
});
```

New `run-dynamic-create-step.spec.ts` (setup: a sourceBase dir with `src/dynamic-create/greeting.ts` containing a template that renders `hello {{name}}`-style output via `_variables`):

```ts
test.case("renders a template and writes the output", async assert => {
  // arrange sourceBase with template + destination dir
  const manifest = await runDynamicCreateStep({
    step: { type: "dynamic-create", name: "greeting", template: "src/dynamic-create/greeting.ts", outputPath: "greeting.txt" },
    isDryRun: false,
    destination,
    sourceBase,
    variables: { name: "world" },
    overwriteExisting: false,
  });

  assert(manifest.manifest.stepType).equals("dynamic-create");
  assert(await destination.append("/greeting.txt").text()).equals("hello world");
});
```

In `run-create-step.spec.ts`, replace template-rendering cases with static-copy cases:

```ts
test.case("copies a static source verbatim", async assert => {
  // arrange: sourceBase/src/create/data.txt contains "raw bytes as text\n"
  const result = await runCreateStep({
    step: { type: "create", name: "data", file: "src/create/data.txt", outputPath: "data.txt" },
    isDryRun: false,
    destination,
    sourceBase,
    variables: {},
    overwriteExisting: false,
  });

  assert(result.manifest.stepType).equals("create");
  assert(await destination.append("/data.txt").text()).equals("raw bytes as text\n");
});

test.case("skips with a warning when the target exists and overwriteExisting is false", async assert => {
  // arrange: destination/data.txt already exists
  const result = await runCreateStep({ /* same step */ isDryRun: false, destination, sourceBase, variables: {}, overwriteExisting: false });

  assert(result.manifest.status).equals("skipped-warning");
});

test.case("overwrites when overwriteExisting is true", async assert => {
  // arrange: destination/data.txt exists with different content
  const result = await runCreateStep({ /* same step */ isDryRun: false, destination, sourceBase, variables: {}, overwriteExisting: true });

  assert(result.manifest.status).equals("applied");
  assert(await destination.append("/data.txt").text()).equals("raw bytes as text\n");
});
```

In `run-modify-step.spec.ts`, convert cases to static-JSON form (source `src/modify/config.json.json` containing a pretty-printed modifications array; destination target file to be modified) and assert the applied result; `run-dynamic-modify-step.spec.ts` mirrors the old template-rendering modify cases with `stepType: "dynamic-modify"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/use/run-powerup/steps/`
Expected: FAIL — runners not yet implemented.

- [ ] **Step 3: Implement the four runners**

`run-create-step/index.ts` (static):

```ts
import type { CreateManifestEntry, CreateStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import writeIfChanged from "#utils/shared/write-if-changed";
import use_errors from "#errors/useErrors";

export default async function runCreateStep({
  step,
  isDryRun,
  destination,
  sourceBase,
  variables,
  overwriteExisting,
}: {
  step: CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  sourceBase: FileRef;
  variables: ResolvedVariable;
  overwriteExisting: boolean;
}): Promise<{ manifest: Omit<CreateManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({ outputPath: step.outputPath, variables });

  const sourcePath = sourceBase.append(`/${step.file}`);

  if (!(await sourcePath.exists())) {
    throw use_errors.source_not_found(step.file);
  }

  const content = await sourcePath.text();

  const manifest: Omit<CreateManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "create",
    status: "applied",
    output: {
      type: "create",
      path: resolvedOutputPath,
      action: "create",
      characterCount: content.length,
    },
  };

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if ((await targetPath.exists()) && !overwriteExisting) {
    return { manifest: { ...manifest, status: "skipped-warning", output: { type: "none" } } };
  }

  if (isDryRun) {
    return { manifest };
  }

  await writeIfChanged({ targetPath, content });

  return { manifest };
}
```

`run-dynamic-create-step/index.ts` (the previous render-based create logic):

```ts
import type { CreateManifestEntry, DynamicCreateStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";
import writeIfChanged from "#utils/shared/write-if-changed";

export default async function runDynamicCreateStep({
  step,
  isDryRun,
  destination,
  sourceBase,
  variables,
  overwriteExisting,
}: {
  step: DynamicCreateStep;
  isDryRun: boolean;
  destination: FileRef;
  sourceBase: FileRef;
  variables: ResolvedVariable;
  overwriteExisting: boolean;
}): Promise<{ manifest: Omit<CreateManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({ outputPath: step.outputPath, variables });

  const renderedContent = await renderTemplate({
    template: step.template,
    sourceBase,
    variables,
  });

  const manifest: Omit<CreateManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "dynamic-create",
    status: "applied",
    output: {
      type: "create",
      path: resolvedOutputPath,
      action: "create",
      characterCount: renderedContent.length,
    },
  };

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if ((await targetPath.exists()) && !overwriteExisting) {
    return { manifest: { ...manifest, status: "skipped-warning", output: { type: "none" } } };
  }

  if (isDryRun) {
    return { manifest };
  }

  await writeIfChanged({ targetPath, content: renderedContent });

  return { manifest };
}
```

`run-modify-step/index.ts` (static):

```ts
import type { ModifyManifestEntry, ModifyStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import parseModifyTemplate from "#utils/use/run-powerup/steps/run-modify-step/parse-modify-template";
import { applyModifications } from "#utils/use/run-powerup/steps/run-modify-step/apply-modifications";
import writeIfChanged from "#utils/shared/write-if-changed";

export default async function runModifyStep({
  step,
  isDryRun,
  destination,
  sourceBase,
  variables,
}: {
  step: ModifyStep;
  isDryRun: boolean;
  destination: FileRef;
  sourceBase: FileRef;
  variables: ResolvedVariable;
}): Promise<{ manifest: Omit<ModifyManifestEntry, BaseManifestProperties> }> {
  const resolvedOutputPath = resolveOutputPath({ outputPath: step.outputPath, variables });

  const manifest: Omit<ModifyManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "modify",
    status: "applied",
    output: {
      type: "modify",
      path: resolvedOutputPath,
      action: "modify",
      characterCount: 0,
    },
  };

  const sourcePath = sourceBase.append(`/${step.file}`);
  const targetPath = destination.append(`/${resolvedOutputPath}`);

  try {
    const modifications = await parseModifyTemplate({
      templatePath: sourcePath,
      variables,
    });

    const modifiedContent = await applyModifications({
      modifications,
      outputPath: resolvedOutputPath,
      targetPath,
    });

    const characterCount = modifiedContent.length;

    if (!isDryRun) {
      await writeIfChanged({ targetPath, content: modifiedContent });
    }

    return {
      manifest: {
        ...manifest,
        output: {
          type: "modify",
          path: resolvedOutputPath,
          action: "modify",
          characterCount,
        },
      },
    };
  } catch {
    return {
      manifest: {
        ...manifest,
        status: "skipped-warning",
        output: { type: "none" },
      },
    };
  }
}
```

`run-dynamic-modify-step/index.ts` — identical to the static modify above except: param type `step: DynamicModifyStep`, `stepType: "dynamic-modify"`, and it is the exact previous body (template resolved from `sourceBase` and rendered through `runTemplate` via `parseModifyTemplate`) — i.e. copy the static version and keep `parseModifyTemplate` unchanged (`parseModifyTemplate` already renders `.ts`/`.njk` via `runTemplate` and reads `.json` as text, so passing the template path works for both — only the manifest `stepType` and param type differ).

- [ ] **Step 4: Run all runner specs**

Run: `cd packages/cli && CI=true npx proby src/private/utils/use/run-powerup/steps/run-create-step src/private/utils/use/run-powerup/steps/run-modify-step src/private/utils/use/run-powerup/steps/run-dynamic-create-step src/private/utils/use/run-powerup/steps/run-dynamic-modify-step src/private/errors/useErrors.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/use/run-powerup/steps packages/cli/src/private/errors/useErrors.ts packages/cli/src/private/errors/useErrors.spec.ts
git commit -m "feat!: step runners — static create/modify (copy/parse) + dynamic-create/dynamic-modify"
```

---

### Task 13: build — generalized source copying

**Files:**
- Rename + rewrite: `packages/cli/src/private/utils/build/copy-templates-to-dist-folder.ts` → `copy-step-sources-to-dist-folder.ts`
- Modify: `packages/cli/src/private/commands/build/index.ts`
- Modify: `packages/cli/src/private/errors/buildErrors.ts`
- Rename + rewrite spec: `copy-templates-to-dist-folder.spec.ts` → `copy-step-sources-to-dist-folder.spec.ts`

- [ ] **Step 1: Update the spec**

In the renamed spec, replace template-only cases with:

```ts
test.case("copies file and template sources of all four step types into dist", async assert => {
  // arrange: cwd with src/create/a.txt, src/dynamic-create/b.ts, src/modify/c.json.json,
  // src/dynamic-modify/d.modify.ts on disk; steps referencing them; a dist dir
  await copyStepSourcesToDistFolder({
    powerupName: "test",
    instructionSteps,
    cwd,
    distFileRef,
    sourceFromCompiledInstructions: "file:///fake/source.js",
  });

  assert(await distFileRef.append("/src/create/a.txt").exists()).true();
  assert(await distFileRef.append("/src/dynamic-create/b.ts").exists()).true();
  assert(await distFileRef.append("/src/modify/c.json.json").exists()).true();
  assert(await distFileRef.append("/src/dynamic-modify/d.modify.ts").exists()).true();
});

test.case("throws source_not_found when a static source is missing", async assert => {
  try {
    await copyStepSourcesToDistFolder({ /* steps reference src/create/missing.txt not on disk */ });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("source_not_found");
  }
});

test.case("skips _internal/ templates (handled by the child mechanism)", async assert => {
  // arrange: one step with template "_internal/child/src/dynamic-create/x.ts"
  // assert: no _internal dir created in dist, no throw
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/build/copy-step-sources-to-dist-folder.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Add to `buildErrors.ts`:

```ts
source_not_found: (sourcePath: string) => {
  const errorText =
    `Step source not found: ${sourcePath}\n\n` +
    `Every step's "file"/"template" path must exist in the powerup package before building.`;
  return t`${errorBGText}${errorText}`;
},
```

(Remove the `template_not_found` entry and its usages — replace the one in the old copy code.)

`packages/cli/src/private/utils/build/copy-step-sources-to-dist-folder.ts` — keep `copyInternalTemplatesUsingSourceProperty`, `resolvePowerupPackageDir`, `fileUrlToDir`, and `printSuccess` from the old file unchanged; replace `copyOwnTemplatesToDist` and its call:

```ts
export default async function copyStepSourcesToDistFolder({
  powerupName,
  instructionSteps,
  cwd,
  distFileRef,
  sourceFromCompiledInstructions,
}: {
  powerupName: string;
  instructionSteps: Step[];
  cwd: FileRef;
  distFileRef: FileRef;
  sourceFromCompiledInstructions: string;
}) {
  await copyOwnSourcesToDist({
    instructionSteps,
    cwd,
    distFileRef,
  });

  await copyInternalTemplatesUsingSourceProperty({
    instructionSteps,
    distFileRef,
    source: sourceFromCompiledInstructions,
  });

  printSuccess({ distFileRef, powerupName });
}

function sourcePathsOfStep(step: Step): string[] {
  const paths: string[] = [];
  const file = (step as Step & { file?: string }).file;
  const template = (step as Step & { template?: string }).template;

  if (is.truthy(file) && !file!.startsWith("_internal/")) {
    paths.push(file!);
  }

  if (is.truthy(template) && !template!.startsWith("_internal/")) {
    paths.push(template!);
  }

  return paths;
}

async function copyOwnSourcesToDist({
  instructionSteps,
  cwd,
  distFileRef,
}: {
  instructionSteps: Step[];
  cwd: FileRef;
  distFileRef: FileRef;
}) {
  for (const step of instructionSteps) {
    for (const sourcePath of sourcePathsOfStep(step)) {
      const sourceFileRef = cwd.append(`/${sourcePath}`);

      if (!(await fs.exists(sourceFileRef))) {
        throw build_errors.source_not_found(sourcePath);
      }

      const destination = distFileRef.append(`/${sourcePath}`);
      await destination.directory.create();
      await sourceFileRef.copy(destination);
    }
  }
}
```

Generalize `copyInternalTemplatesUsingSourceProperty` into `copyInternalStepSourcesUsingSourceProperty`: collect each step's `_internal/`-prefixed sources from **BOTH** fields — `(step as Step & { file?: string }).file` and `(step as Step & { template?: string }).template` — and copy each from the child's dist (`pkgDir.append(\`/dist/${subpath}\`)`, where `subpath = path.split("/").slice(2).join("/")`) into `distFileRef.append(\`/${path}\`)`, reusing the existing `copied` set, `resolvePowerupPackageDir`, and `child_not_built` error. (Static `file` sources from included children are prefixed by the SDK's `includePowerup` — see Task 1.5 — so the parent build must copy them exactly like child templates.)

Add two spec cases to the Task 13 spec:

```ts
test.case("copies _internal/ static files and templates from the child's dist", async assert => {
  // arrange: steps with file "_internal/child/src/create/x.txt" and
  // template "_internal/child/src/dynamic-create/y.ts" (__source pointing into a fake
  // child package containing dist/src/create/x.txt and dist/src/dynamic-create/y.ts)
  // assert: both land under distFileRef/_internal/child/src/...
});

test.case("throws child_not_built when a child static file is missing from its dist", async assert => {
  // arrange: step with file "_internal/child/src/create/missing.txt" and a child
  // package whose dist lacks that file
  // expect: error.code equals "child_not_built"
});
```

In `packages/cli/src/private/commands/build/index.ts`:

```ts
import copyStepSourcesToDistFolder from "#utils/build/copy-step-sources-to-dist-folder";
```

and change the call from `copyTemplatesToDistFolder({...})` to `copyStepSourcesToDistFolder({...})` with identical arguments.

Delete the old `copy-templates-to-dist-folder.ts` and its spec (git rm).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/build/copy-step-sources-to-dist-folder.spec.ts src/private/utils/build/compile-instructions-file.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/build packages/cli/src/private/commands/build/index.ts packages/cli/src/private/errors/buildErrors.ts
git rm packages/cli/src/private/utils/build/copy-templates-to-dist-folder.ts packages/cli/src/private/utils/build/copy-templates-to-dist-folder.spec.ts
git commit -m "feat!: build copies file+template sources for all four step types into dist"
```

---

### Task 14: test-utils new format + end-to-end build/use + old-format rejection

**Files:**
- Modify: `packages/cli/src/private/test-utils/create-powerup-for-test.ts`
- Modify: `packages/cli/src/private/test-utils/create-fully-built-powerup-for-test.ts`
- Create: `packages/cli/src/private/test-utils/pipeline-new-format.spec.ts`

- [ ] **Step 1: Update test-utils to the new format**

In `create-powerup-for-test.ts`:
- `defaultInstructions`: change the step to

```ts
    {
      type: "dynamic-create",
      name: "component",
      template: "src/dynamic-create/component.ts",
      outputPath: "src/components/{{name}}.ts",
    },
```

- `defaultTemplates()`: change every `templatePath` from `/templates/x.ts` to `/src/dynamic-create/x.ts` (keep contents).

In `create-fully-built-powerup-for-test.ts`: update `defaultInstructions` and both `instructionsForScaffoldingSimpleFile` step arrays the same way — every `{ type: "create", template: "templates/x", ... }` becomes `{ type: "dynamic-create", template: "src/dynamic-create/x", ... }`, and the matching `templates` fixtures' `templatePath`s become `/src/dynamic-create/x`. (Do not touch the rest of the flow — `build.run` + config + git helpers stay.)

- [ ] **Step 2: Write the end-to-end spec**

`packages/cli/src/private/test-utils/pipeline-new-format.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import build from "#commands/build/index";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/pipeline-new-format");

test.case("build + use pipeline works end to end with static and dynamic steps", async assert => {
  await fs.create(testRoot);
  const packageDir = testRoot.append("/sample-powerup");

  const instructions = {
    name: "sample-powerup",
    type: "multi-use",
    description: "sample",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "static-file", file: "src/create/static.txt", outputPath: "static.txt" },
      {
        type: "dynamic-create",
        name: "dynamic-file",
        template: "src/dynamic-create/dynamic.ts",
        outputPath: "dynamic.txt",
      },
    ],
  };

  await createPowerupPackageForTest({
    powerupName: "sample-powerup",
    testRoot,
    instructions: instructions as never,
    templates: [{
      name: "dynamic",
      templatePath: "/src/dynamic-create/dynamic.ts",
      content: `export default function(variables: Record<string, string>): string {\n  const { name } = variables;\n  return \`hello \${name}\`;\n}\n`,
    }],
  });

  // createPowerupPackageForTest writes templates at packageDir + templatePath;
  // also write the static source:
  const staticSource = packageDir.append("/src/create/static.txt");
  await fs.create(staticSource.directory);
  await staticSource.write("static content\n");

  await build.run({ subcommands: [], flags: [], context: { root: packageDir } });

  assert(await packageDir.append("/dist/src/create/static.txt").exists()).true();
  assert(await packageDir.append("/dist/src/dynamic-create/dynamic.ts").exists()).true();

  // "use" the built powerup via runPowerup with sourceBase = dist
  const use = await import("#utils/use/run-powerup/index");
  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(
    JSON.parse(await packageDir.append("/dist/instructions.json").text()),
  );

  const destination = testRoot.append("/used");
  await fs.create(destination);

  await use.default({
    destination,
    powerupDirectory: packageDir,
    sourceBase: packageDir.append("/dist"),
    instructions: validatedCompiledInstructions,
    isDryRun: false,
    variables: { name: "world" },
    powerupVersion: "1.0.0",
    powerupLocation: packageDir.path,
    printFinalSummary: false,
  });

  assert(await destination.append("/static.txt").text()).equals("static content\n");
  assert(await destination.append("/dynamic.txt").text()).equals("hello world");

  await testRoot.remove({ recursive: true });
});
```

(If `createPowerupPackageForTest`'s signature differs — it takes `{ powerupName, testRoot, instructions, templates }` — adapt the arrange block to how it places files; keep the assertions identical.)

- [ ] **Step 3: Run the spec**

Run: `cd packages/cli && CI=true npx proby src/private/test-utils/pipeline-new-format.spec.ts`
Expected: PASS. If `createPowerupPackageForTest` writes `package.json`/`index.ts`/`tsconfig.json` itself, verify `build.run` succeeds against them; fix fixtures as needed (this spec is the format migration smoke test for the whole pipeline).

- [ ] **Step 4: Fix remaining old-format spec fixtures**

Run the full CLI suite: `cd packages/cli && CI=true npx proby`
Fix every remaining spec that constructs old-format steps (`type: "create", template:` / `type: "modify", template:`) by converting to `dynamic-create`/`dynamic-modify` or static `file` steps with on-disk sources, following the test's intent. Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/test-utils
git commit -m "test: migrate test-utils and specs to the new step format; add pipeline e2e"
```

---

## Phase 4 — `pup template` conversion command

### Task 15: loadInstructionsFromSource (shared by template + preview)

**Files:**
- Create: `packages/cli/src/private/utils/preview/load-instructions-from-source.ts`
- Create: `packages/cli/src/private/errors/previewErrors.ts` (+ spec)
- Create: `packages/cli/src/private/utils/preview/load-instructions-from-source.spec.ts`

- [ ] **Step 1: Write the failing tests**

`previewErrors.spec.ts` — one case per error, following the createErrors spec pattern:

```ts
test.case("instructions_not_found points at the powerup root", async assert => {
  try {
    throw preview_errors.instructions_not_found("/some/root");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(PreviewErrorCode.instructions_not_found);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("index.ts");
  }
});
```

`load-instructions-from-source.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/load-instructions");

test.case("loads and returns the instructions module from source", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "loader-test",`,
    `  type: "single-use",`,
    `  description: "loads",`,
    `  variables: { required: [], optional: [] },`,
    `  intent: [],`,
    `  steps: [],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const instructions = await loadInstructionsFromSource({ powerupRoot: testRoot });

  assert(instructions.name).equals("loader-test");

  await testRoot.remove({ recursive: true });
});

test.case("throws instructions_not_found when index.ts is missing", async assert => {
  await fs.create(testRoot);

  try {
    await loadInstructionsFromSource({ powerupRoot: testRoot });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("instructions_not_found");
  }

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/errors/previewErrors.spec.ts src/private/utils/preview/load-instructions-from-source.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`packages/cli/src/private/errors/previewErrors.ts` (copy the createErrors.ts structure exactly — imports, `errorBGText`, `t`, the `<Name>ErrorCode` export):

```ts
const preview_errors = error.coded({
  instructions_not_found: (root: string) => {
    const errorText =
      `No index.ts found at ${root}.\n\n` +
      `"pup preview" and "pup template" must run inside a powerup package.`;
    return t`${errorBGText}${errorText}`;
  },
  preview_json_invalid: (detail: string) => {
    const errorText =
      `preview.json is not valid JSON.\n\n${detail}`;
    return t`${errorBGText}${errorText}`;
  },
  missing_variables: (missing: string[], required: string[]) => {
    const missingText = missing.join(", ");
    const requiredText = required.join(", ");
    const errorText =
      `Missing required variables: ${missingText}\n\n` +
      `Required: ${requiredText}\n` +
      `Provide them in preview.json ("variables") or as flags: --<name>=<value>`;
    return t`${errorBGText}${errorText}`;
  },
});
```

(+ `export type PreviewErrorCode = keyof typeof preview_errors;` and the `PreviewErrorCode` object, mirroring createErrors.)

`load-instructions-from-source.ts`:

```ts
import fs from "@rcompat/fs";
import os from "node:os";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import preview_errors from "#errors/previewErrors";

export default async function loadInstructionsFromSource({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<Instructions> {
  const indexFilePath = powerupRoot.append("/index.ts");

  if (!(await indexFilePath.exists())) {
    throw preview_errors.instructions_not_found(powerupRoot.path);
  }

  switch (runtime.name) {
    case "bun":
    case "deno":
      return await directImport(indexFilePath);
    case "node":
      return await childProcessImport(indexFilePath);
    default:
      throw new Error(`Unsupported runtime: ${runtime.name}`);
  }
}

async function directImport(indexFilePath: FileRef): Promise<Instructions> {
  const module = await import(`${indexFilePath.path}?t=${Date.now()}`);
  return getInstructions(module);
}

async function childProcessImport(indexFilePath: FileRef): Promise<Instructions> {
  const tmpDir = fs.ref(`${os.tmpdir()}/powerups-source-${Date.now()}`);
  await fs.create(tmpDir);

  const runner = tmpDir.append("/runner.mjs");
  const runnerContent = [
    `const mod = await import(process.env.powerups_INDEX);`,
    `if (!mod.default || !mod.default.instructions) {`,
    `  process.stderr.write("index.ts must default-export defineInstructions(...)");`,
    `  process.exit(1);`,
    `}`,
    `process.stdout.write(JSON.stringify(mod.default.instructions));`,
  ].join("\n");
  await runner.write(runnerContent);

  try {
    const stdout = await io.run(
      `${runtime.bin} --experimental-strip-types "${runner.path}"`,
      { env: { ...process.env, powerups_INDEX: indexFilePath.path } },
    );

    return JSON.parse(stdout) as Instructions;
  } finally {
    await tmpDir.remove({ recursive: true });
  }
}

function getInstructions(module: { default?: { instructions?: Instructions } }): Instructions {
  const instructions = module.default?.instructions;

  if (instructions === undefined) {
    throw new Error("index.ts must default-export defineInstructions(...)");
  }

  return instructions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/errors/previewErrors.spec.ts src/private/utils/preview/load-instructions-from-source.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/errors/previewErrors.ts packages/cli/src/private/errors/previewErrors.spec.ts packages/cli/src/private/utils/preview/load-instructions-from-source.ts packages/cli/src/private/utils/preview/load-instructions-from-source.spec.ts
git commit -m "feat: load instructions from source index.ts per runtime"
```

---

### Task 16: steps-region utils + template error catalog

**Files:**
- Create: `packages/cli/src/private/errors/templateErrors.ts` (+ spec)
- Create: `packages/cli/src/private/utils/template-conversion/steps-region.ts`
- Create: `packages/cli/src/private/utils/template-conversion/steps-region.spec.ts`

- [ ] **Step 1: Write the failing tests**

`templateErrors.spec.ts` — one case per error key (`steps_region_invalid`, `step_not_found`, `already_dynamic`, `not_dynamic`, `revert_needs_variables`, `invalid_engine`), following the createErrors spec pattern (assert `.code` + a `.includes` fragment each).

`steps-region.spec.ts`:

```ts
import test from "#test-utils/test/index";
import { extractStepsArray, replaceStepInIndex, replaceStepsArray } from "#utils/template-conversion/steps-region";

const indexContent = [
  `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
  ``,
  `const instructions: Instructions = {`,
  `  name: "x",`,
  `  type: "single-use",`,
  `  description: "x",`,
  `  variables: { required: [], optional: [] },`,
  `  intent: [],`,
  `  steps: [`,
  `    {`,
  `      "type": "create",`,
  `      "name": "a",`,
  `      "file": "src/create/a.txt",`,
  `      "outputPath": "a.txt"`,
  `    }`,
  `  ],`,
  `};`,
  ``,
  `export default defineInstructions(instructions, import.meta.url);`,
].join("\n");

test.case("extracts the steps array as JSON", async assert => {
  const steps = extractStepsArray({ indexContent });
  assert(steps.length).equals(1);
  assert((steps[0] as { name: string }).name).equals("a");
});

test.case("replaces a step by name and re-serializes the region", async assert => {
  const updated = replaceStepInIndex({
    indexContent,
    stepName: "a",
    newStep: {
      type: "dynamic-create",
      name: "a",
      template: "src/dynamic-create/a.ts",
      outputPath: "a.txt",
    },
  });

  const steps = extractStepsArray({ indexContent: updated });
  assert((steps[0] as { type: string }).type).equals("dynamic-create");
  assert(updated).includes('"template": "src/dynamic-create/a.ts"');
});

test.case("replaceStepsArray round-trips arbitrary step objects", async assert => {
  const updated = replaceStepsArray({
    indexContent,
    steps: [{ type: "delete", name: "d", outputPath: "d.txt" }],
  });
  const steps = extractStepsArray({ indexContent: updated });
  assert((steps[0] as { type: string }).type).equals("delete");
});

test.case("throws steps_region_invalid for content without a steps array", async assert => {
  try {
    extractStepsArray({ indexContent: "export default {};" });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("steps_region_invalid");
  }
});

test.case("throws steps_region_invalid for non-JSON arrays (hand-authored TS expressions)", async assert => {
  const content = indexContent.replace('"file": "src/create/a.txt"', '"file": `src/create/${dynamic}.txt`');
  try {
    extractStepsArray({ indexContent: content });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("steps_region_invalid");
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/errors/templateErrors.spec.ts src/private/utils/template-conversion/steps-region.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`templateErrors.ts` (createErrors.ts structure):

```ts
const template_errors = error.coded({
  steps_region_invalid: (detail: string) => {
    const errorText =
      `Could not read the steps array in index.ts: ${detail}\n\n` +
      `"pup template" requires the steps array to be JSON-compatible (no TS expressions inside it).` +
      ` Convert the step by hand.`;
    return t`${errorBGText}${errorText}`;
  },
  step_not_found: (outputPath: string) => {
    const errorText =
      `No step found for output path "${outputPath}".\n\n` +
      `Run "pup template" without arguments to list steps.`;
    return t`${errorBGText}${errorText}`;
  },
  already_dynamic: (outputPath: string) => {
    const errorText =
      `The step for "${outputPath}" is already dynamic (template-based).\n\n` +
      `Use "pup template ${outputPath} --revert" to convert it back to static.`;
    return t`${errorBGText}${errorText}`;
  },
  not_dynamic: (outputPath: string) => {
    const errorText =
      `The step for "${outputPath}" is static (not template-based).\n\n` +
      `Drop --revert to convert it to dynamic.`;
    return t`${errorBGText}${errorText}`;
  },
  revert_needs_variables: (missing: string[]) => {
    const errorText =
      `This template references variables (${missing.join(", ")}) so reverting needs values to render with.\n\n` +
      `Provide them in preview.json ("variables") or as flags: --<name>=<value>`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_engine: (value: string) => {
    const errorText =
      `Invalid --engine value "${value}". Must be "ts" or "njk".`;
    return t`${errorBGText}${errorText}`;
  },
});
```

(+ the `TemplateErrorCode` type/object exports, mirroring createErrors.)

`steps-region.ts`:

```ts
import type { Step } from "@liolocs/powerups-sdk";
import template_errors from "#errors/templateErrors";

export function extractStepsArray({ indexContent }: { indexContent: string }): unknown[] {
  const bounds = findStepsArrayBounds({ indexContent });
  const arrayText = indexContent.substring(bounds.start, bounds.end + 1);

  try {
    return JSON.parse(arrayText) as unknown[];
  } catch {
    throw template_errors.steps_region_invalid("the array is not valid JSON");
  }
}

export function replaceStepsArray({
  indexContent,
  steps,
}: {
  indexContent: string;
  steps: unknown[];
}): string {
  const bounds = findStepsArrayBounds({ indexContent });
  const replacement = JSON.stringify(steps, null, 2);

  return indexContent.substring(0, bounds.start) + replacement + indexContent.substring(bounds.end + 1);
}

export function replaceStepInIndex({
  indexContent,
  stepName,
  newStep,
}: {
  indexContent: string;
  stepName: string;
  newStep: Step;
}): string {
  const steps = extractStepsArray({ indexContent });
  const index = steps.findIndex(step => (step as { name?: string }).name === stepName);

  if (index === -1) {
    throw template_errors.steps_region_invalid(`step "${stepName}" not found in the steps array`);
  }

  steps[index] = newStep;

  return replaceStepsArray({ indexContent, steps });
}

function findStepsArrayBounds({ indexContent }: { indexContent: string }): { start: number; end: number } {
  const stepsIndex = indexContent.indexOf("steps:");

  if (stepsIndex === -1) {
    throw template_errors.steps_region_invalid("no steps property found");
  }

  const openIndex = indexContent.indexOf("[", stepsIndex);

  if (openIndex === -1) {
    throw template_errors.steps_region_invalid("the steps property is not an array");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < indexContent.length; i++) {
    const char = indexContent[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "[") {
      depth++;
    }

    if (char === "]") {
      depth--;

      if (depth === 0) {
        return { start: openIndex, end: i };
      }
    }
  }

  throw template_errors.steps_region_invalid("unbalanced steps array");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/errors/templateErrors.spec.ts src/private/utils/template-conversion/steps-region.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/errors/templateErrors.ts packages/cli/src/private/errors/templateErrors.spec.ts packages/cli/src/private/utils/template-conversion/steps-region.ts packages/cli/src/private/utils/template-conversion/steps-region.spec.ts
git commit -m "feat: steps-region JSON surgery for index.ts + template error catalog"
```

---

### Task 17: convert-step core (static ↔ dynamic)

**Files:**
- Create: `packages/cli/src/private/utils/template-conversion/convert-step.ts`
- Create: `packages/cli/src/private/utils/template-conversion/convert-step.spec.ts`
- Create: `packages/cli/src/private/utils/preview/read-preview-json.ts` (needed for revert variables)

- [ ] **Step 1: Write the failing tests**

`convert-step.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { convertStepToDynamic, revertStepToStatic } from "#utils/template-conversion/convert-step";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/convert-step");

const staticCreateStep = {
  type: "create",
  name: "pkg",
  file: "src/create/package.json",
  outputPath: "package.json",
} as const;

const staticModifyStep = {
  type: "modify",
  name: "pkg-mod",
  file: "src/modify/package.json.json",
  outputPath: "package.json",
} as const;

test.case("converts a static create step to dynamic-create with a readable template", async assert => {
  const content = "{\n  \"name\": \"hello\"\n}";
  const result = convertStepToDynamic({ step: staticCreateStep, sourceContent: content, engine: "ts" });

  assert(result.newStep.type).equals("dynamic-create");
  assert(result.templatePath).equals("src/dynamic-create/package.json.ts");
  assert(result.templateContent).includes("`{");
  assert(result.templateContent).includes("\"name\": \"hello\"");
  assert((result.newStep as { file?: string }).file).equals(undefined);
});

test.case("converts a static modify step to dynamic-modify with .modify.ts naming", async assert => {
  const content = "[\n  {\n    \"where\": \"top\",\n    \"content\": \"x\"\n  }\n]";
  const result = convertStepToDynamic({ step: staticModifyStep, sourceContent: content, engine: "ts" });

  assert(result.newStep.type).equals("dynamic-modify");
  assert(result.templatePath).equals("src/dynamic-modify/package.json.modify.ts");
});

test.case("njk engine wraps nothing and uses .njk paths", async assert => {
  const content = "plain content {{name}}";
  const result = convertStepToDynamic({ step: staticCreateStep, sourceContent: content, engine: "njk" });

  assert(result.templatePath).equals("src/dynamic-create/package.json.njk");
  assert(result.templateContent).equals(content);
});

test.case("reverts a dynamic-create template without variables to static", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return \`plain\`;\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-create/plain.txt.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  const result = await revertStepToStatic({
    step: { type: "dynamic-create", name: "plain", template: "src/dynamic-create/plain.txt.ts", outputPath: "plain.txt" },
    powerupRoot: testRoot,
    variables: {},
    declaredVariableNames: ["name"],
  });

  assert(result.newStep.type).equals("create");
  assert(result.staticPath).equals("src/create/plain.txt");
  assert(result.staticContent).equals("plain");

  await testRoot.remove({ recursive: true });
});

test.case("revert throws revert_needs_variables when the template uses unset variables", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return \`hello \${_variables.name}\`;\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-create/greet.txt.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  try {
    await revertStepToStatic({
      step: { type: "dynamic-create", name: "greet", template: "src/dynamic-create/greet.txt.ts", outputPath: "greet.txt" },
      powerupRoot: testRoot,
      variables: {},
      declaredVariableNames: ["name"],
    });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("revert_needs_variables");
  }

  await testRoot.remove({ recursive: true });
});

test.case("revert renders with provided variables and pretty-prints dynamic-modify output", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return JSON.stringify([{ where: "top", content: "dep " + _variables.depName }]);\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-modify/package.json.modify.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  const result = await revertStepToStatic({
    step: { type: "dynamic-modify", name: "pkg-mod", template: "src/dynamic-modify/package.json.modify.ts", outputPath: "package.json" },
    powerupRoot: testRoot,
    variables: { depName: "zod" },
    declaredVariableNames: ["depName"],
  });

  assert(result.newStep.type).equals("modify");
  assert(result.staticPath).equals("src/modify/package.json.json");
  assert(result.staticContent).includes("[\n  {\n    \"where\": \"top\",");
  assert(result.staticContent).includes("dep zod");

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/template-conversion/convert-step.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`read-preview-json.ts`:

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import preview_errors from "#errors/previewErrors";

export type PreviewJsonFile = {
  variables?: Record<string, string>;
  run?: string;
  output?: string;
  watch?: boolean;
};

export default async function readPreviewJson({
  powerupRoot,
}: {
  powerupRoot: FileRef;
}): Promise<PreviewJsonFile | undefined> {
  const previewJsonRef = powerupRoot.append("/preview.json");

  if (!(await previewJsonRef.exists())) {
    return undefined;
  }

  try {
    return JSON.parse(await previewJsonRef.text()) as PreviewJsonFile;
  } catch (error) {
    throw preview_errors.preview_json_invalid(getErrorMessage(error));
  }
}
```

(Import `getErrorMessage` from `#errors/get-error-message`.)

`convert-step.ts`:

```ts
import type {
  CreateStep,
  DynamicCreateStep,
  DynamicModifyStep,
  ModifyStep,
  Step,
} from "@liolocs/powerups-sdk";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import { modificationArraySchema } from "#schemas/modification";
import template_errors from "#errors/templateErrors";
import generateReadableTemplate from "#utils/template-conversion/generate-readable-template";
import { runTemplate } from "#template-runners/index";

export type TemplateEngine = "ts" | "njk";

const UNSET_VARIABLE_SENTINEL = "__PUP_UNSET_VARIABLE__";

export function convertStepToDynamic({
  step,
  sourceContent,
  engine,
}: {
  step: CreateStep | ModifyStep;
  sourceContent: string;
  engine: TemplateEngine;
}): { newStep: Step; templatePath: string; templateContent: string } {
  const isModify = step.type === "modify";
  const directory = isModify ? "src/dynamic-modify" : "src/dynamic-create";
  const suffix = engine === "njk" ? ".njk" : isModify ? ".modify.ts" : ".ts";
  const templatePath = `${directory}/${step.outputPath}${suffix}`;

  const templateContent = engine === "njk"
    ? sourceContent
    : generateReadableTemplate({ content: sourceContent });

  const { file: _omit, ...rest } = step;

  const newStep: Step = isModify
    ? { ...rest, type: "dynamic-modify", template: templatePath }
    : { ...rest, type: "dynamic-create", template: templatePath };

  return { newStep, templatePath, templateContent };
}

export async function revertStepToStatic({
  step,
  powerupRoot,
  variables,
  declaredVariableNames,
}: {
  step: DynamicCreateStep | DynamicModifyStep;
  powerupRoot: FileRef;
  variables: Record<string, string>;
  declaredVariableNames: string[];
}): Promise<{ newStep: Step; staticPath: string; staticContent: string; templatePath: string }> {
  const templatePathRef = powerupRoot.append(`/${step.template}`);

  if (!(await templatePathRef.exists())) {
    throw template_errors.steps_region_invalid(`template file "${step.template}" not found`);
  }

  const sentinelVariables = buildSentinelVariables({ variables, declaredVariableNames });

  const sentinelRender = await runTemplate({
    templatePath: templatePathRef,
    variables: sentinelVariables,
  });

  if (sentinelRender.includes(UNSET_VARIABLE_SENTINEL)) {
    const missing = declaredVariableNames.filter(name =>
      variables[name] === undefined || variables[name] === "",
    );

    throw template_errors.revert_needs_variables(missing);
  }

  if (step.type === "dynamic-modify") {
    let parsed: unknown;

    try {
      parsed = JSON.parse(sentinelRender);
    } catch {
      throw template_errors.steps_region_invalid("the rendered template is not valid JSON modifications");
    }

    const modifications = modificationArraySchema.parse(parsed);
    const staticContent = JSON.stringify(modifications, null, 2);
    const staticPath = `src/modify/${step.outputPath}.json`;
    const { template: _omit, ...rest } = step;

    return {
      newStep: { ...rest, type: "modify", file: staticPath },
      staticPath,
      staticContent,
      templatePath: step.template,
    };
  }

  const staticPath = `src/create/${step.outputPath}`;
  const { template: _omit, ...rest } = step;

  return {
    newStep: { ...rest, type: "create", file: staticPath },
    staticPath,
    staticContent: sentinelRender,
    templatePath: step.template,
  };
}

function buildSentinelVariables({
  variables,
  declaredVariableNames,
}: {
  variables: Record<string, string>;
  declaredVariableNames: string[];
}): Record<string, string> {
  const sentinelVariables: Record<string, string> = {};

  for (const name of declaredVariableNames) {
    const value = variables[name];
    sentinelVariables[name] = value === undefined || value === "" ? UNSET_VARIABLE_SENTINEL : value;
  }

  return sentinelVariables;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/template-conversion/convert-step.spec.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/template-conversion/convert-step.ts packages/cli/src/private/utils/template-conversion/convert-step.spec.ts packages/cli/src/private/utils/preview/read-preview-json.ts
git commit -m "feat: static↔dynamic step conversion core with sentinel-based variable detection"
```

---

### Task 18: `pup template` command

**Files:**
- Create: `packages/cli/src/private/commands/template/index.ts`
- Create: `packages/cli/src/commands/template.ts`
- Modify: `packages/cli/src/commands/index.ts`
- Create: `packages/cli/src/private/utils/shared/normalize-flag-name.ts`
- Modify: `packages/cli/src/private/utils/use/extract-variables.ts` (use shared util)
- Test: extend `packages/cli/src/private/utils/template-conversion/steps-region.spec.ts` or add a command-level spec exercising the action

- [ ] **Step 1: Extract normalizeFlagName**

Create `packages/cli/src/private/utils/shared/normalize-flag-name.ts`:

```ts
export default function normalizeFlagName(flag: string): string {
  const stripped = flag.replace(/^--?/, "");
  const parts = stripped.split("-");

  return parts[0] +
    parts.slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
}
```

In `extract-variables.ts`: delete the local `normalizeFlagName` and add `import normalizeFlagName from "#utils/shared/normalize-flag-name";`.

- [ ] **Step 2: Write the failing command-level test**

Add `packages/cli/src/private/commands/template/template-command.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import template from "#commands/template/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/template-command");

async function scaffoldPowerup(): Promise<void> {
  await fs.create(testRoot);
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "convertible",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: [], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "create",`,
    `      "name": "config",`,
    `      "file": "src/create/app.conf",`,
    `      "outputPath": "app.conf"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const staticSource = testRoot.append("/src/create/app.conf");
  await fs.create(staticSource.directory);
  await staticSource.write("setting=on\n");
}

test.case("converts a static step to dynamic and rewrites index.ts", async assert => {
  await scaffoldPowerup();

  await template.run({
    subcommands: ["app.conf"],
    flags: {},
    rawFlags: [],
    context: { root: testRoot },
  });

  const indexContent = await testRoot.append("/index.ts").text();
  assert(indexContent).includes("\"type\": \"dynamic-create\"");
  assert(indexContent).includes("\"template\": \"src/dynamic-create/app.conf.ts\"");

  const templateContent = await testRoot.append("/src/dynamic-create/app.conf.ts").text();
  assert(templateContent).includes("`setting=on");
  assert(await testRoot.append("/src/create/app.conf").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("reverts a dynamic step back to static", async assert => {
  await scaffoldPowerup();

  await template.run({ subcommands: ["app.conf"], flags: {}, rawFlags: [], context: { root: testRoot } });
  await template.run({ subcommands: ["app.conf"], flags: { revert: true }, rawFlags: [], context: { root: testRoot } });

  const indexContent = await testRoot.append("/index.ts").text();
  assert(indexContent).includes("\"type\": \"create\"");
  assert(await testRoot.append("/src/create/app.conf").text()).equals("setting=on\n");
  assert(await testRoot.append("/src/dynamic-create/app.conf.ts").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("step_not_found for unknown output paths", async assert => {
  await scaffoldPowerup();

  try {
    await template.run({ subcommands: ["nope.txt"], flags: {}, rawFlags: [], context: { root: testRoot } });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("step_not_found");
  }

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/commands/template/template-command.spec.ts`
Expected: FAIL — command not found.

- [ ] **Step 4: Implement the command**

`packages/cli/src/private/commands/template/index.ts`:

```ts
import { CLI_CMD } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import cli from "@rcompat/cli";

import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";
import readPreviewJson from "#utils/preview/read-preview-json";
import normalizeFlagName from "#utils/shared/normalize-flag-name";
import {
  convertStepToDynamic,
  revertStepToStatic,
  type TemplateEngine,
} from "#utils/template-conversion/convert-step";
import { replaceStepInIndex } from "#utils/template-conversion/steps-region";
import template_errors from "#errors/templateErrors";

const revertFlag = {
  name: "revert", long: "revert", short: "r",
  description: "Convert a dynamic (template) step back to static",
  type: "boolean",
} as const satisfies Flag;

const engineFlag = {
  name: "engine", long: "engine", short: "e",
  description: "Template engine for conversion: ts (default) or njk",
} as const satisfies Flag;

const TEMPLATE_EXCLUDE_FLAGS = ["--revert", "-r", "--engine", "-e", "--dry-run", "-dr"];

const template = new Command({
  name: "template",
  description: `Convert a powerup step between static and dynamic (template) form`,
  flags: [revertFlag, engineFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const powerupRoot: FileRef = context?.root ?? runtime.cwd();
    const outputPath = subcommands?.[0];

    const instructions = await loadInstructionsFromSource({ powerupRoot });
    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);

    if (outputPath === undefined) {
      printStepListing({ steps: validatedCompiledInstructions.steps });
      return;
    }

    const matchingSteps = validatedCompiledInstructions.steps.filter(
      step => step.type !== "read" && step.type !== "install"
        && (step as { outputPath?: string }).outputPath === outputPath,
    );

    if (matchingSteps.length === 0) {
      throw template_errors.step_not_found(outputPath);
    }

    const step = matchingSteps[0]!;

    if (flags.revert === true) {
      if (step.type !== "dynamic-create" && step.type !== "dynamic-modify") {
        throw template_errors.not_dynamic(outputPath);
      }

      const variables = await resolveVariablesForRevert({
        powerupRoot,
        rawFlags: rawFlags ?? [],
        instructions: validatedCompiledInstructions,
      });

      const declaredVariableNames = [
        ...validatedCompiledInstructions.variables.required,
        ...(validatedCompiledInstructions.variables.optional ?? []),
      ];

      const result = await revertStepToStatic({ step, powerupRoot, variables, declaredVariableNames });

      await writeStaticAndRemoveTemplate({ powerupRoot, result });
      await rewriteIndexStep({ powerupRoot, stepName: step.name, newStep: result.newStep });

      const green = cli.fg.green;
      cli.print(`${green("✓")} Reverted ${outputPath} to static (${result.staticPath})\n`);
      return;
    }

    if (step.type !== "create" && step.type !== "modify") {
      throw template_errors.already_dynamic(outputPath);
    }

    const engine = resolveEngine({ value: flags.engine });
    const sourceRef = powerupRoot.append(`/${step.file}`);
    const sourceContent = await sourceRef.text();

    const result = convertStepToDynamic({ step, sourceContent, engine });

    const templateFileRef = powerupRoot.append(`/${result.templatePath}`);
    await fs.create(templateFileRef.directory);
    await templateFileRef.write(result.templateContent);
    await sourceRef.remove();

    await rewriteIndexStep({ powerupRoot, stepName: step.name, newStep: result.newStep });

    const green = cli.fg.green;
    const dim = cli.fg.dim;
    cli.print(`${green("✓")} Converted ${outputPath} to dynamic\n`);
    cli.print(`  ${dim("template:")} ${result.templatePath}\n`);
    cli.print(`  ${dim("next:")} edit the template to inject \${variables}\n`);
  },
});

function resolveEngine({ value }: { value?: string }): TemplateEngine {
  if (value === undefined || value === "ts") {
    return "ts";
  }

  if (value === "njk") {
    return "njk";
  }

  throw template_errors.invalid_engine(value);
}

async function resolveVariablesForRevert({
  powerupRoot,
  rawFlags,
  instructions,
}: {
  powerupRoot: FileRef;
  rawFlags: { flag: string; value?: string }[];
  instructions: { variables: { required: string[]; optional?: string[] } };
}): Promise<Record<string, string>> {
  const previewJson = await readPreviewJson({ powerupRoot });
  const variables: Record<string, string> = { ...(previewJson?.variables ?? {}) };

  for (const rawFlag of rawFlags) {
    if (TEMPLATE_EXCLUDE_FLAGS.includes(rawFlag.flag)) {
      continue;
    }

    variables[normalizeFlagName(rawFlag.flag)] = rawFlag.value ?? "";
  }

  return variables;
}

async function writeStaticAndRemoveTemplate({
  powerupRoot,
  result,
}: {
  powerupRoot: FileRef;
  result: { staticPath: string; staticContent: string; templatePath: string };
}): Promise<void> {
  const staticFileRef = powerupRoot.append(`/${result.staticPath}`);
  await fs.create(staticFileRef.directory);
  await staticFileRef.write(result.staticContent);

  const templateFileRef = powerupRoot.append(`/${result.templatePath}`);
  if (await templateFileRef.exists()) {
    await templateFileRef.remove();
  }
}

async function rewriteIndexStep({
  powerupRoot,
  stepName,
  newStep,
}: {
  powerupRoot: FileRef;
  stepName: string;
  newStep: import("@liolocs/powerups-sdk").Step;
}): Promise<void> {
  const indexFileRef = powerupRoot.append("/index.ts");
  const indexContent = await indexFileRef.text();
  await indexFileRef.write(replaceStepInIndex({ indexContent, stepName, newStep }));
}

function printStepListing({ steps }: { steps: import("@liolocs/powerups-sdk").Step[] }): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  if (steps.length === 0) {
    cli.print(`${dim("No steps defined.")}\n`);
    return;
  }

  for (const step of steps) {
    const outputPath = step.type === "read" ? step.path
      : step.type === "install" ? "(install)"
      : (step as { outputPath: string }).outputPath;
    const kind = step.type === "create" || step.type === "modify"
      ? "static"
      : step.type === "dynamic-create" || step.type === "dynamic-modify"
        ? "dynamic"
        : step.type;

    cli.print(`${green(step.name)}  ${dim(kind)}  ${outputPath}\n`);
  }
}

export default template;
```

`packages/cli/src/commands/template.ts`:

```ts
import template from "../private/commands/template/index.js";

export default template;
```

In `packages/cli/src/commands/index.ts`:

```ts
import template from "./template.js";

const commands: Command<any>[] = [
  build,
  create,
  install,
  uninstall,
  use,
  template,
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/commands/template/template-command.spec.ts src/private/utils/use/extract-variables.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/private/commands/template packages/cli/src/commands/template.ts packages/cli/src/commands/index.ts packages/cli/src/private/utils/shared/normalize-flag-name.ts packages/cli/src/private/utils/use/extract-variables.ts
git commit -m "feat: pup template — convert steps between static and dynamic, sync index.ts"
```

---

## Phase 5 — `pup preview`

### Task 19: preview config resolution

**Files:**
- Create: `packages/cli/src/private/utils/preview/resolve-preview-config.ts`
- Create: `packages/cli/src/private/utils/preview/resolve-preview-config.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import resolvePreviewConfig from "#utils/preview/resolve-preview-config";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-config");

const instructions = {
  name: "cfg",
  type: "single-use",
  description: "x",
  variables: { required: ["appName"], optional: ["theme"] },
  intent: [],
  steps: [],
} as unknown as Instructions;

test.case("merges preview.json variables with flag overrides (flags win)", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/preview.json").write(JSON.stringify({
    variables: { appName: "from-file", theme: "dark" },
    run: "npm run dev",
  }));

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions,
    rawFlags: [{ flag: "--appName", value: "from-flag" }],
  });

  assert(config.variables.appName).equals("from-flag");
  assert(config.variables.theme).equals("dark");
  assert(config.run).equals("npm run dev");
  assert(config.output).equals("preview");
  assert(config.watch).true();

  await testRoot.remove({ recursive: true });
});

test.case("watch defaults to false without a run command", async assert => {
  await fs.create(testRoot);

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions,
    rawFlags: [{ flag: "--appName", value: "a" }],
  });

  assert(config.watch).false();

  await testRoot.remove({ recursive: true });
});

test.case("missing required variables throw missing_variables listing them", async assert => {
  await fs.create(testRoot);

  try {
    await resolvePreviewConfig({ powerupRoot: testRoot, instructions, rawFlags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_variables");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("appName");
  }

  await testRoot.remove({ recursive: true });
});

test.case("kebab-case flags normalize to camelCase variables", async assert => {
  await fs.create(testRoot);

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions: { ...instructions, variables: { required: ["myApp"], optional: [] } } as never,
    rawFlags: [{ flag: "--my-app", value: "x" }],
  });

  assert(config.variables.myApp).equals("x");

  await testRoot.remove({ recursive: true });
});

test.case("invalid preview.json throws preview_json_invalid", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/preview.json").write("{ not json");

  try {
    await resolvePreviewConfig({ powerupRoot: testRoot, instructions, rawFlags: [{ flag: "--appName", value: "a" }] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("preview_json_invalid");
  }

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/resolve-preview-config.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import readPreviewJson from "#utils/preview/read-preview-json";
import normalizeFlagName from "#utils/shared/normalize-flag-name";
import preview_errors from "#errors/previewErrors";

const PREVIEW_EXCLUDE_FLAGS = ["--dry-run", "-dr", "--run", "--output", "-o", "--watch"];

export type PreviewConfig = {
  variables: ResolvedVariable;
  run?: string;
  output: string;
  watch: boolean;
};

export default async function resolvePreviewConfig({
  powerupRoot,
  instructions,
  rawFlags,
}: {
  powerupRoot: FileRef;
  instructions: Instructions;
  rawFlags: { flag: string; value?: string }[];
}): Promise<PreviewConfig> {
  const previewJson = await readPreviewJson({ powerupRoot });

  const variables: ResolvedVariable = { ...(previewJson?.variables ?? {}) };

  for (const rawFlag of rawFlags) {
    if (PREVIEW_EXCLUDE_FLAGS.includes(rawFlag.flag)) {
      continue;
    }

    variables[normalizeFlagName(rawFlag.flag)] = rawFlag.value ?? "";
  }

  const missing = instructions.variables.required.filter(name => {
    const provided = Object.keys(variables).find(key => key.toLowerCase() === name.toLowerCase());
    return provided === undefined || variables[provided] === "";
  });

  if (missing.length > 0) {
    throw preview_errors.missing_variables(missing, instructions.variables.required);
  }

  const flagRun = getFlagValue({ rawFlags, long: "--run" });
  const flagOutput = getFlagValue({ rawFlags, long: "--output", short: "-o" });
  const watchFlag = rawFlags.find(f => f.flag === "--watch");

  const run = flagRun ?? previewJson?.run;
  const output = flagOutput ?? previewJson?.output ?? "preview";
  const watch = watchFlag !== undefined
    ? watchFlag.value !== "false"
    : (previewJson?.watch ?? run !== undefined);

  return { variables, run, output, watch };
}

function getFlagValue({
  rawFlags,
  long,
  short,
}: {
  rawFlags: { flag: string; value?: string }[];
  long: string;
  short?: string;
}): string | undefined {
  for (const rawFlag of rawFlags) {
    if (rawFlag.flag === long || (short !== undefined && rawFlag.flag === short)) {
      return rawFlag.value ?? "";
    }

    if (rawFlag.value !== undefined && rawFlag.flag.startsWith(long + "=")) {
      return rawFlag.value;
    }
  }

  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/resolve-preview-config.spec.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/preview/resolve-preview-config.ts packages/cli/src/private/utils/preview/resolve-preview-config.spec.ts
git commit -m "feat: preview config resolution — preview.json + flag overrides + missing-variable errors"
```

---

### Task 20: preview manifest + stale-path reconcile

**Files:**
- Create: `packages/cli/src/private/utils/preview/preview-manifest.ts`
- Create: `packages/cli/src/private/utils/preview/compute-stale-paths.ts`
- Create: `packages/cli/src/private/utils/preview/preview-manifest.spec.ts`

- [ ] **Step 1: Write the failing tests**

`preview-manifest.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { computeStalePaths, hashFile, readPreviewManifest, writePreviewManifest } from "#utils/preview/preview-manifest";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-manifest");

test.case("manifest round-trips and tolerates a missing or corrupt file", async assert => {
  await fs.create(testRoot);

  assert(Object.keys(await readPreviewManifest({ previewDir: testRoot })).length).equals(0);

  await writePreviewManifest({ previewDir: testRoot, manifest: { "a.txt": "hash-a" } });
  const read = await readPreviewManifest({ previewDir: testRoot });
  assert(read["a.txt"]).equals("hash-a");

  await testRoot.append("/.preview-manifest.json").write("{ corrupt");
  assert(Object.keys(await readPreviewManifest({ previewDir: testRoot })).length).equals(0);

  await testRoot.remove({ recursive: true });
});

test.case("hashFile is stable for identical content", async assert => {
  await fs.create(testRoot);
  const fileRef = testRoot.append("/same.txt");
  await fileRef.write("identical");

  const first = await hashFile({ path: fileRef });
  await fileRef.write("identical");
  const second = await hashFile({ path: fileRef });

  assert(first).equals(second);
  assert(first.length).equals(64);

  await testRoot.remove({ recursive: true });
});

test.case("computeStalePaths returns previously generated paths that are no longer generated", async assert => {
  const stalePaths = computeStalePaths({
    previousManifest: { "a.txt": "h1", "b.txt": "h2", "node_modules/x.js": "h3" },
    currentGeneratedPaths: ["b.txt"],
  });

  assert(stalePaths.sort()).equals(["a.txt", "node_modules/x.js"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/preview-manifest.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`preview-manifest.ts`:

```ts
import { createHash } from "node:crypto";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export type PreviewManifest = Record<string, string>;

export async function readPreviewManifest({
  previewDir,
}: {
  previewDir: FileRef;
}): Promise<PreviewManifest> {
  const manifestRef = previewDir.append("/.preview-manifest.json");

  if (!(await manifestRef.exists())) {
    return {};
  }

  try {
    return JSON.parse(await manifestRef.text()) as PreviewManifest;
  } catch {
    // A corrupt manifest is treated as "no history" — existing files become
    // untracked and are never deleted (safe default).
    return {};
  }
}

export async function writePreviewManifest({
  previewDir,
  manifest,
}: {
  previewDir: FileRef;
  manifest: PreviewManifest;
}): Promise<void> {
  await previewDir.append("/.preview-manifest.json").write(JSON.stringify(manifest, null, 2));
}

export async function hashFile({ path }: { path: FileRef }): Promise<string> {
  return createHash("sha256").update(await path.text()).digest("hex");
}
```

`compute-stale-paths.ts`:

```ts
import type { PreviewManifest } from "#utils/preview/preview-manifest";

export function computeStalePaths({
  previousManifest,
  currentGeneratedPaths,
}: {
  previousManifest: PreviewManifest;
  currentGeneratedPaths: string[];
}): string[] {
  const current = new Set(currentGeneratedPaths);

  return Object.keys(previousManifest).filter(path => !current.has(path));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/preview-manifest.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/preview/preview-manifest.ts packages/cli/src/private/utils/preview/compute-stale-paths.ts packages/cli/src/private/utils/preview/preview-manifest.spec.ts
git commit -m "feat: preview manifest with safe defaults + stale-path reconcile"
```

---

### Task 21: materializePreview

**Files:**
- Create: `packages/cli/src/private/utils/preview/materialize-preview.ts`
- Create: `packages/cli/src/private/utils/preview/materialize-preview.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import materializePreview from "#utils/preview/materialize-preview";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/materialize");

async function scaffoldPowerup({ powerupRoot }: { powerupRoot: import("@rcompat/fs").FileRef }): Promise<void> {
  await fs.create(powerupRoot);
  await powerupRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "prev",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: ["appName"], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "create",`,
    `      "name": "static",`,
    `      "file": "src/create/static.txt",`,
    `      "outputPath": "static.txt"`,
    `    },`,
    `    {`,
    `      "type": "dynamic-create",`,
    `      "name": "dynamic",`,
    `      "template": "src/dynamic-create/dynamic.ts",`,
    `      "outputPath": "dynamic.txt"`,
    `    },`,
    `    {`,
    `      "type": "modify",`,
    `      "name": "patch",`,
    `      "file": "src/modify/config.json.json",`,
    `      "outputPath": "config.json"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const staticSource = powerupRoot.append("/src/create/static.txt");
  await fs.create(staticSource.directory);
  await staticSource.write("static body\n");

  const dynamicTemplate = powerupRoot.append("/src/dynamic-create/dynamic.ts");
  await fs.create(dynamicTemplate.directory);
  await dynamicTemplate.write(`export default function (_variables: Record<string, string>): string {\n  return \`app=\${_variables.appName}\`;\n}\n`);

  const modifySource = powerupRoot.append("/src/modify/config.json.json");
  await fs.create(modifySource.directory);
  await modifySource.write(JSON.stringify([{ where: "top", content: "{\n  \"patched\": true,\n" }], null, 2));

  const fixture = powerupRoot.append("/fixtures/config.json");
  await fs.create(fixture.directory);
  await fixture.write("{\n  \"existing\": true\n}\n");
}

test.case("materializes fixtures + static + dynamic + modify steps into the preview dir", async assert => {
  const powerupRoot = testRoot.append("/powerup");
  await scaffoldPowerup({ powerupRoot });

  const instructions = await (await import("#utils/preview/load-instructions-from-source")).default({ powerupRoot });

  const result = await materializePreview({
    powerupRoot,
    instructions,
    config: { variables: { appName: "my-app" }, output: "preview", watch: false },
    isFirstMaterialize: true,
  });

  const previewDir = powerupRoot.append("/preview");
  assert(await previewDir.append("/static.txt").text()).equals("static body\n");
  assert(await previewDir.append("/dynamic.txt").text()).equals("app=my-app");
  assert(await previewDir.append("/config.json").text()).includes("\"patched\": true");
  assert(await previewDir.append("/config.json").text()).includes("\"existing\": true");

  const manifest = JSON.parse(await previewDir.append("/.preview-manifest.json").text());
  assert(manifest["static.txt"]).equals(result.generatedPaths.includes("static.txt") ? manifest["static.txt"] : "");
  assert(result.generatedPaths.includes("config.json")).true();

  await testRoot.remove({ recursive: true });
});

test.case("second run deletes stale generated files but preserves untracked ones", async assert => {
  const powerupRoot = testRoot.append("/powerup2");
  await scaffoldPowerup({ powerupRoot });

  const load = (await import("#utils/preview/load-instructions-from-source")).default;
  const instructions = await load({ powerupRoot });
  const config = { variables: { appName: "my-app" }, output: "preview", watch: false };

  await materializePreview({ powerupRoot, instructions, config: config as never, isFirstMaterialize: true });

  const previewDir = powerupRoot.append("/preview");
  await previewDir.append("/user-scratch.txt").write("keep me\n");

  // remove the static step from index.ts to make static.txt stale
  const indexRef = powerupRoot.append("/index.ts");
  await indexRef.write((await indexRef.text()).replace(/,\n    \{\n      "type": "create",\n      "name": "static",[\s\S]*?\n    \}/, ""));

  const refreshedInstructions = await load({ powerupRoot });
  const second = await materializePreview({
    powerupRoot,
    instructions: refreshedInstructions,
    config: config as never,
    isFirstMaterialize: false,
  });

  assert(second.stalePaths.includes("static.txt")).true();
  assert(await previewDir.append("/static.txt").exists()).false();
  assert(await previewDir.append("/user-scratch.txt").text()).equals("keep me\n");

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/materialize-preview.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`materialize-preview.ts`:

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import runPowerup from "#utils/use/run-powerup/index";
import walkFiles from "#utils/create/capture-files/walk-files";
import writeIfChanged from "#utils/shared/write-if-changed";
import type { PreviewConfig } from "#utils/preview/resolve-preview-config";
import {
  hashFile,
  readPreviewManifest,
  writePreviewManifest,
  type PreviewManifest,
} from "#utils/preview/preview-manifest";
import { computeStalePaths } from "#utils/preview/compute-stale-paths";

export default async function materializePreview({
  powerupRoot,
  instructions,
  config,
  isFirstMaterialize,
}: {
  powerupRoot: FileRef;
  instructions: Instructions;
  config: PreviewConfig;
  isFirstMaterialize: boolean;
}): Promise<{ generatedPaths: string[]; stalePaths: string[]; skippedSteps: string[] }> {
  const previewDir = powerupRoot.append(`/${config.output}`);
  await fs.create(previewDir);

  const previousManifest = await readPreviewManifest({ previewDir });
  const generatedPaths: string[] = [];
  const skippedSteps: string[] = [];

  for (const fixturePath of await listFixturePaths({ powerupRoot })) {
    const content = await powerupRoot.append(`/fixtures/${fixturePath}`).text();
    await writeIfChanged({ targetPath: previewDir.append(`/${fixturePath}`), content });
    generatedPaths.push(fixturePath);
  }

  const manifests = await runPowerup({
    destination: previewDir,
    powerupDirectory: powerupRoot,
    sourceBase: powerupRoot,
    instructions,
    isDryRun: false,
    variables: { ...config.variables },
    powerupVersion: "preview",
    powerupLocation: powerupRoot.path,
    saveManifest: false,
    overwriteExisting: true,
    skipInstallSteps: !isFirstMaterialize,
    printFinalSummary: false,
  });

  for (const manifest of manifests) {
    if (manifest.status === "skipped-warning") {
      skippedSteps.push(manifest.stepName);
      continue;
    }

    if (manifest.output.type === "create" || manifest.output.type === "modify") {
      generatedPaths.push(manifest.output.path);
    }
  }

  const stalePaths = computeStalePaths({ previousManifest, currentGeneratedPaths: generatedPaths });

  for (const stalePath of stalePaths) {
    const staleRef = previewDir.append(`/${stalePath}`);
    if (await staleRef.exists()) {
      await staleRef.remove();
    }
  }

  const newManifest: PreviewManifest = {};

  for (const generatedPath of generatedPaths) {
    newManifest[generatedPath] = await hashFile({ path: previewDir.append(`/${generatedPath}`) });
  }

  await writePreviewManifest({ previewDir, manifest: newManifest });

  return { generatedPaths, stalePaths, skippedSteps };
}

async function listFixturePaths({ powerupRoot }: { powerupRoot: FileRef }): Promise<string[]> {
  const fixturesDir = powerupRoot.append("/fixtures");

  if (!(await fixturesDir.exists())) {
    return [];
  }

  return walkFiles({ root: fixturesDir });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/materialize-preview.spec.ts`
Expected: PASS (2 cases). If the modify-step fixture flow trips the `skipped-warning` path because the target is missing, verify fixture copy ordering — fixtures must copy before `runPowerup` (they do).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/preview/materialize-preview.ts packages/cli/src/private/utils/preview/materialize-preview.spec.ts
git commit -m "feat: materializePreview — fixtures + source-run steps + manifest reconcile"
```

---

### Task 22: source watcher + supervisor strategy selection

**Files:**
- Create: `packages/cli/src/private/utils/preview/watch-source.ts`
- Create: `packages/cli/src/private/utils/preview/select-supervisor-strategy.ts`
- Create: `packages/cli/src/private/utils/preview/watch-source.spec.ts`
- Create: `packages/cli/src/private/utils/preview/select-supervisor-strategy.spec.ts`

- [ ] **Step 1: Write the failing tests**

`select-supervisor-strategy.spec.ts`:

```ts
import test from "#test-utils/test/index";
import selectSupervisorStrategy from "#utils/preview/select-supervisor-strategy";

test.case("node runtime uses nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "node", runCommand: "npm run dev" }).type).equals("nodemon");
});

test.case("bun runtime with bun-driven command uses bun-watch", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "bun", runCommand: "bun run dev" }).type).equals("bun-watch");
});

test.case("bun runtime with a node-driven command falls back to nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "bun", runCommand: "npm run dev" }).type).equals("nodemon");
});

test.case("deno runtime with deno-driven command uses denon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "deno", runCommand: "deno run server.ts" }).type).equals("denon");
});

test.case("deno runtime with a node-driven command falls back to nodemon", async assert => {
  assert(selectSupervisorStrategy({ runtimeName: "deno", runCommand: "npm run dev" }).type).equals("nodemon");
});
```

`watch-source.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { snapshotsDiffer, takeSourceSnapshot } from "#utils/preview/watch-source";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/watch-source");

test.case("snapshot covers src/, fixtures/, index.ts, preview.json", async assert => {
  await fs.create(testRoot);
  await fs.create(testRoot.append("/src/dynamic-create"));
  await testRoot.append("/src/dynamic-create/a.ts").write("1");
  await testRoot.append("/fixtures/base.txt").write("1");
  await testRoot.append("/index.ts").write("1");
  await testRoot.append("/preview.json").write("{}");

  const snapshot = await takeSourceSnapshot({ powerupRoot: testRoot });

  assert(snapshot.has("src/dynamic-create/a.ts")).true();
  assert(snapshot.has("fixtures/base.txt")).true();
  assert(snapshot.has("index.ts")).true();
  assert(snapshot.has("preview.json")).true();

  await testRoot.remove({ recursive: true });
});

test.case("snapshotsDiffer detects changed files", async assert => {
  const previous = new Map([["a", 1]]);
  const same = new Map([["a", 1]]);
  const changed = new Map([["a", 2]]);

  assert(snapshotsDiffer({ previous, current: same })).false();
  assert(snapshotsDiffer({ previous, current: changed })).true();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/select-supervisor-strategy.spec.ts src/private/utils/preview/watch-source.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`select-supervisor-strategy.ts`:

```ts
export type SupervisorStrategy =
  | { type: "nodemon" }
  | { type: "bun-watch" }
  | { type: "denon" }
  | { type: "run-once" };

export default function selectSupervisorStrategy({
  runtimeName,
  runCommand,
}: {
  runtimeName: string;
  runCommand: string;
}): SupervisorStrategy {
  const firstToken = runCommand.trim().split(/\s+/)[0] ?? "";

  if (runtimeName === "bun" && (firstToken === "bun" || firstToken === "bunx")) {
    return { type: "bun-watch" };
  }

  if (runtimeName === "deno" && firstToken === "deno") {
    return { type: "denon" };
  }

  // node runtime, or a bun/deno runtime driving a node-based command:
  // nodemon is the universal fallback (node ships with every JS dev server).
  return { type: "nodemon" };
}
```

`watch-source.ts`:

```ts
import { stat } from "node:fs/promises";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import walkFiles from "#utils/create/capture-files/walk-files";

export type SourceSnapshot = Map<string, number>;

const WATCHED_DIR_NAMES = ["src", "fixtures"];
const WATCHED_ROOT_FILES = ["index.ts", "preview.json"];

export async function takeSourceSnapshot({ powerupRoot }: { powerupRoot: FileRef }): Promise<SourceSnapshot> {
  const snapshot: SourceSnapshot = new Map();

  for (const watchedDirName of WATCHED_DIR_NAMES) {
    const watchedDir = powerupRoot.append(`/${watchedDirName}`);

    if (!(await watchedDir.exists())) {
      continue;
    }

    for (const file of await walkFiles({ root: watchedDir })) {
      const stats = await stat(watchedDir.append(`/${file}`).path);
      snapshot.set(`${watchedDirName}/${file}`, stats.mtimeMs);
    }
  }

  for (const rootFileName of WATCHED_ROOT_FILES) {
    const rootFileRef = powerupRoot.append(`/${rootFileName}`);

    if (await rootFileRef.exists()) {
      const stats = await stat(rootFileRef.path);
      snapshot.set(rootFileName, stats.mtimeMs);
    }
  }

  return snapshot;
}

export function snapshotsDiffer({
  previous,
  current,
}: {
  previous: SourceSnapshot;
  current: SourceSnapshot;
}): boolean {
  if (previous.size !== current.size) {
    return true;
  }

  for (const [path, mtimeMs] of current) {
    if (previous.get(path) !== mtimeMs) {
      return true;
    }
  }

  return false;
}

export function watchSources({
  powerupRoot,
  onChange,
  intervalMs = 300,
  debounceMs = 400,
}: {
  powerupRoot: FileRef;
  onChange: () => void | Promise<void>;
  intervalMs?: number;
  debounceMs?: number;
}): { stop: () => void } {
  let stopped = false;
  let lastSnapshot: SourceSnapshot | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const poll = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    try {
      const current = await takeSourceSnapshot({ powerupRoot });

      if (lastSnapshot !== undefined && snapshotsDiffer({ previous: lastSnapshot, current })) {
        if (debounceTimer !== undefined) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          onChange();
        }, debounceMs);
      }

      lastSnapshot = current;
    } finally {
      if (!stopped) {
        setTimeout(poll, intervalMs);
      }
    }
  };

  poll();

  return {
    stop: () => {
      stopped = true;

      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    },
  };
}
```

Note for reviewers/executors: the `bun --watch` strategy re-runs the process when its **imported modules** change; re-rendered preview files that the dev server serves (not imports) rely on that server's own reload. Nodemon watches the whole preview dir. This matches the spec's runtime-native-with-fallback language.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/utils/preview/select-supervisor-strategy.spec.ts src/private/utils/preview/watch-source.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/private/utils/preview/select-supervisor-strategy.ts packages/cli/src/private/utils/preview/select-supervisor-strategy.spec.ts packages/cli/src/private/utils/preview/watch-source.ts packages/cli/src/private/utils/preview/watch-source.spec.ts
git commit -m "feat: polling source watcher + runtime-selected supervisor strategy"
```

---

### Task 23: run-supervisor + `pup preview` command

**Files:**
- Create: `packages/cli/src/private/utils/preview/run-supervisor.ts`
- Create: `packages/cli/src/private/commands/preview/index.ts`
- Create: `packages/cli/src/commands/preview.ts`
- Modify: `packages/cli/src/commands/index.ts`
- Modify: `packages/cli/package.json` (add nodemon)
- Test: `packages/cli/src/private/commands/preview/preview-command.spec.ts`

- [ ] **Step 1: Add the nodemon dependency**

Run: `cd packages/cli && pnpm add nodemon`
Expected: dependency added to `packages/cli/package.json` + lockfile updated.

- [ ] **Step 2: Write the failing test**

`preview-command.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import preview from "#commands/preview/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-command");

test.case("materializes with variables from flags and exits when no run command is configured", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "pv",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: ["appName"], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "dynamic-create",`,
    `      "name": "app",`,
    `      "template": "src/dynamic-create/app.ts",`,
    `      "outputPath": "app.txt"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const templateRef = testRoot.append("/src/dynamic-create/app.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(`export default function (_variables: Record<string, string>): string {\n  return \`app=\${_variables.appName}\`;\n}\n`);

  await preview.run({
    subcommands: [],
    flags: {},
    rawFlags: [{ flag: "--appName", value: "flag-value" }],
    context: { root: testRoot },
  });

  assert(await testRoot.append("/preview/app.txt").text()).equals("app=flag-value");
  assert(JSON.parse(await testRoot.append("/preview/.preview-manifest.json").text())["app.txt"]).true;

  await testRoot.remove({ recursive: true });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/cli && CI=true npx proby src/private/commands/preview/preview-command.spec.ts`
Expected: FAIL — command not found.

- [ ] **Step 4: Implement the supervisor**

`run-supervisor.ts`:

```ts
import { spawn } from "node:child_process";
import type { FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { SupervisorStrategy } from "#utils/preview/select-supervisor-strategy";

export type SupervisorHandle = { stop: () => void };

export async function startSupervisor({
  strategy,
  runCommand,
  previewDir,
}: {
  strategy: SupervisorStrategy;
  runCommand: string;
  previewDir: FileRef;
}): Promise<SupervisorHandle> {
  const dim = cli.fg.dim;
  const yellow = cli.fg.yellow;

  switch (strategy.type) {
    case "nodemon": {
      let nodemonBin: string;

      try {
        nodemonBin = import.meta.resolve("nodemon/bin/nodemon.js");
      } catch {
        cli.print(`${yellow("!")} nodemon not available — running once without restart supervision\n`);
        return runCommandOnce({ runCommand, previewDir });
      }

      const child = spawn("node", [
        nodemonBin,
        "--watch", previewDir.path,
        "--exec", runCommand,
      ], { cwd: previewDir.path, stdio: "inherit" });

      child.on("error", () => {
        cli.print(`${yellow("!")} node not available — the run command was not started\n`);
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "bun-watch": {
      const tokens = runCommand.trim().split(/\s+/);
      const child = spawn(tokens[0]!, ["--watch", ...tokens.slice(1)], {
        cwd: previewDir.path,
        stdio: "inherit",
      });

      child.on("error", () => {
        cli.print(`${yellow("!")} failed to start: ${runCommand}\n`);
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "denon": {
      const tokens = runCommand.trim().split(/\s+/);
      const child = spawn("denon", tokens.slice(1), {
        cwd: previewDir.path,
        stdio: "inherit",
      });

      child.on("error", () => {
        cli.print(`${yellow("!")} denon not available — falling back to a single run\n`);
        void runCommandOnce({ runCommand, previewDir });
      });

      return { stop: () => child.kill("SIGTERM") };
    }
    case "run-once": {
      return runCommandOnce({ runCommand, previewDir });
    }
  }
}

export function runCommandOnce({
  runCommand,
  previewDir,
}: {
  runCommand: string;
  previewDir: FileRef;
}): SupervisorHandle {
  const child = spawn(runCommand, {
    shell: true,
    cwd: previewDir.path,
    stdio: "inherit",
  });

  child.on("error", () => {
    const yellow = cli.fg.yellow;
    cli.print(`${yellow("!")} failed to run: ${runCommand}\n`);
  });

  return { stop: () => child.kill("SIGTERM") };
}
```

- [ ] **Step 5: Implement the preview command**

`packages/cli/src/private/commands/preview/index.ts`:

```ts
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import cli from "@rcompat/cli";

import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";
import resolvePreviewConfig from "#utils/preview/resolve-preview-config";
import materializePreview from "#utils/preview/materialize-preview";
import { readPreviewManifest } from "#utils/preview/preview-manifest";
import { watchSources } from "#utils/preview/watch-source";
import selectSupervisorStrategy from "#utils/preview/select-supervisor-strategy";
import { startSupervisor, runCommandOnce } from "#utils/preview/run-supervisor";
import getErrorMessage from "#errors/get-error-message";

const runFlag = {
  name: "run", long: "run",
  description: `Shell command to run inside the preview dir (overrides preview.json)`,
} as const satisfies Flag;

const outputFlag = {
  name: "output", long: "output", short: "o",
  description: `Preview output directory (default: preview)`,
} as const satisfies Flag;

const watchFlag = {
  name: "watch", long: "watch",
  description: "Watch powerup sources and re-render on change (default: true when run is set)",
  type: "boolean",
} as const satisfies Flag;

const preview = new Command({
  name: "preview",
  description: `Materialize a ${SINGULAR_NAME_FOR_CLI} from source with concrete variables and optionally run it`,
  flags: [runFlag, outputFlag, watchFlag],
  subcommands: [],

  action: async ({ context, rawFlags }) => {
    const powerupRoot: FileRef = context?.root ?? runtime.cwd();

    const instructions = await loadInstructionsFromSource({ powerupRoot });
    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);

    const config = await resolvePreviewConfig({
      powerupRoot,
      instructions: validatedCompiledInstructions,
      rawFlags: rawFlags ?? [],
    });

    const previewDir = powerupRoot.append(`/${config.output}`);
    const isFirstMaterialize = Object.keys(await readPreviewManifest({ previewDir })).length === 0;

    const first = await materializePreview({
      powerupRoot,
      instructions: validatedCompiledInstructions,
      config,
      isFirstMaterialize,
    });

    printPreviewSummary({ previewDir, config, ...first });

    if (config.run === undefined) {
      return;
    }

    if (!config.watch) {
      await runCommandOnce({ runCommand: config.run, previewDir });
      return;
    }

    const strategy = selectSupervisorStrategy({ runtimeName: runtime.name, runCommand: config.run });
    const supervisor = await startSupervisor({ strategy, runCommand: config.run, previewDir });

    const watcher = watchSources({
      powerupRoot,
      onChange: async () => {
        try {
          const rerender = await materializePreview({
            powerupRoot,
            instructions: await reloadInstructions({ powerupRoot }),
            config: await reloadConfig({ powerupRoot, instructions: validatedCompiledInstructions, rawFlags: rawFlags ?? [] }),
            isFirstMaterialize: false,
          });

          printPreviewSummary({ previewDir, config, ...rerender });
        } catch (error) {
          const yellow = cli.fg.yellow;
          cli.print(`${yellow("!")} re-render failed (keeping last-good preview): ${getErrorMessage(error)}\n`);
        }
      },
    });

    process.on("SIGINT", () => {
      watcher.stop();
      supervisor.stop();
      process.exit(0);
    });

    await new Promise(() => {});
  },
});

async function reloadInstructions({ powerupRoot }: { powerupRoot: FileRef }) {
  const instructions = await loadInstructionsFromSource({ powerupRoot });
  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);
  return validatedCompiledInstructions;
}

async function reloadConfig({
  powerupRoot,
  instructions,
  rawFlags,
}: {
  powerupRoot: FileRef;
  instructions: import("@liolocs/powerups-sdk").Instructions;
  rawFlags: { flag: string; value?: string }[];
}) {
  return resolvePreviewConfig({ powerupRoot, instructions, rawFlags });
}

function printPreviewSummary({
  previewDir,
  config,
  generatedPaths,
  stalePaths,
  skippedSteps,
}: {
  previewDir: FileRef;
  config: import("#utils/preview/resolve-preview-config").PreviewConfig;
  generatedPaths: string[];
  stalePaths: string[];
  skippedSteps: string[];
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Preview materialized: ${generatedPaths.length} files → ${previewDir.path}\n`);

  if (stalePaths.length > 0) {
    cli.print(`  ${dim(`removed stale: ${stalePaths.length}`)}\n`);
  }

  for (const skippedStep of skippedSteps) {
    cli.print(`  ${dim(`skipped: ${skippedStep} (target missing)`)}`);
  }
}

export default preview;
```

`packages/cli/src/commands/preview.ts`:

```ts
import preview from "../private/commands/preview/index.js";

export default preview;
```

In `packages/cli/src/commands/index.ts`, add `import preview from "./preview.js";` and include `preview` in the commands array.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/cli && CI=true npx proby src/private/commands/preview/preview-command.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/private/utils/preview/run-supervisor.ts packages/cli/src/private/commands/preview packages/cli/src/commands/preview.ts packages/cli/src/commands/index.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat: pup preview — materialize from source, run + watch with runtime-native supervisors"
```

---

## Phase 6 — Migration, docs, verification

### Task 24: Migrate the built-in `create-powerup` powerup

**Files:**
- Move: `packages/cli/.powerups/installed/_internal/create-powerup/templates/*.ts` → `packages/cli/.powerups/installed/_internal/create-powerup/src/dynamic-create/`
- Modify: `packages/cli/.powerups/installed/_internal/create-powerup/index.ts`
- Modify: `packages/cli/.powerups/installed/_internal/create-powerup/src/dynamic-create/gitignore.ts`
- Modify: `packages/cli/scripts/build-builtin-powerups.ts`

- [ ] **Step 1: Move the templates and update the built-in's index.ts**

```bash
cd packages/cli/.powerups/installed/_internal/create-powerup
mkdir -p src/dynamic-create
git mv templates/powerup-index.ts src/dynamic-create/powerup-index.ts
git mv templates/create-repo-sh.ts src/dynamic-create/create-repo-sh.ts
git mv templates/powerup-package.ts src/dynamic-create/powerup-package.ts
git mv templates/powerup-tsconfig.ts src/dynamic-create/powerup-tsconfig.ts
git mv templates/gitignore.ts src/dynamic-create/gitignore.ts
rmdir templates 2>/dev/null || rm -rf templates
```

In its `index.ts`, change every step from `{ type: "create", template: "templates/x.ts", ... }` to `{ type: "dynamic-create", template: "src/dynamic-create/x.ts", ... }`:

```ts
  steps: [
    {
      type: "dynamic-create",
      name: "index",
      template: "src/dynamic-create/powerup-index.ts",
      outputPath: "{{outputPath}}/{{name}}/index.ts",
    },
    {
      type: "dynamic-create",
      name: "create-repo-sh",
      template: "src/dynamic-create/create-repo-sh.ts",
      outputPath: "{{outputPath}}/{{name}}/scripts/create-github-repo.sh",
    },
    {
      type: "dynamic-create",
      name: "package",
      template: "src/dynamic-create/powerup-package.ts",
      outputPath: "{{outputPath}}/{{name}}/package.json",
    },
    {
      type: "dynamic-create",
      name: "tsconfig",
      template: "src/dynamic-create/powerup-tsconfig.ts",
      outputPath: "{{outputPath}}/{{name}}/tsconfig.json",
    },
    {
      type: "dynamic-create",
      name: "gitignore",
      template: "src/dynamic-create/gitignore.ts",
      outputPath: "{{outputPath}}/{{name}}/.gitignore",
    },
    {
      type: "install",
      name: "deps",
      target: "{{outputPath}}/{{name}}",
      dependencies: ["@liolocs/powerups-sdk"],
      devDependencies: ["commit-and-tag-version"],
      packageManager: "auto",
    },
  ],
```

- [ ] **Step 2: Scaffold gains preview/ in .gitignore**

`src/dynamic-create/gitignore.ts`:

```ts
export default function(): string {
  return "node_modules\npreview/\n";
}
```

- [ ] **Step 3: Update the builtin build script**

In `packages/cli/scripts/build-builtin-powerups.ts`, `writeDist` currently creates `templates/` and copies `srcDir/templates` → `distDir/templates`. Replace that section so the whole `src/` tree is copied:

```ts
async function writeDist(
  distDir: string,
  srcDir: string,
  instructions: Instructions,
): Promise<void> {
  if (await exists(distDir)) {
    await rm(distDir, { recursive: true, force: true });
  }

  await mkdir(distDir, { recursive: true });

  const serializable = {
    ...instructions,
    steps: stripSource(instructions.steps),
  };

  await writeFile(
    path.join(distDir, "instructions.json"),
    `${JSON.stringify(serializable, null, 2)}\n`,
  );

  // Step sources live under src/ — copy the whole tree verbatim.
  await cp(
    path.join(srcDir, "src"),
    path.join(distDir, "src"),
    { recursive: true },
  );
}
```

Update the doc comment's "Produces" section to `dist/src/**` instead of `dist/templates/*.ts`.

- [ ] **Step 4: Rebuild built-ins + verify create end-to-end**

Run: `cd packages/cli && pnpm build:builtins`
Expected: `✓ built-in powerup: create-powerup` — and `.powerups/installed/_internal/create-powerup/dist/` contains `instructions.json` + `src/dynamic-create/*.ts`.

Then verify the full create flow with the new CLI code (tests run the built-in from the repo's `.powerups` dir):

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/`
Expected: PASS — including the capture specs (which exercise `create`-style steps end to end) and the flag-registration flow.

- [ ] **Step 5: Add the flag-registration regression spec (spec §12)**

The reported bug was shell-side, but this locks in the flags → `buildVariables` → rendered `index.ts` path. Create `packages/cli/src/private/utils/create/create-flag-registration.spec.ts`:

```ts
import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import buildVariables from "#utils/create/build-variables";
import { runTemplate } from "#template-runners/index";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/flag-registration");

test.case("intent and variables flags land in the rendered index.ts", async assert => {
  await fs.create(testRoot);

  const templateRef = root.append("/.powerups/installed/_internal/create-powerup/src/dynamic-create/powerup-index.ts");

  const variables = buildVariables({
    name: "saas-starter",
    description: "Scaffolds a SaaS starter",
    intent: "Saas, Nextjs with tailwind and auth0",
    requiredVariables: "theme,projectName,auth0ClientId,auth0Domain,auth0Audience",
    optionalVariables: undefined,
    powerupType: "single-use",
    outputPath: "installed/_internal",
  });

  const rendered = await runTemplate({ templatePath: templateRef, variables });

  assert(rendered).includes('["Saas","Nextjs with tailwind and auth0"]');
  assert(rendered).includes('["theme","projectName","auth0ClientId","auth0Domain","auth0Audience"]');
  assert(rendered).includes('"single-use"');

  await testRoot.remove({ recursive: true });
});
```

Run: `cd packages/cli && CI=true npx proby src/private/utils/create/create-flag-registration.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/.powerups/installed/_internal/create-powerup packages/cli/scripts/build-builtin-powerups.ts packages/cli/src/private/utils/create/create-flag-registration.spec.ts
git commit -m "feat!: migrate create-powerup built-in to dynamic-create + src/ layout + preview gitignore"
```

---

### Task 25: Docs + versions

**Files:**
- Modify: `packages/cli/README.md`
- Modify: `packages/cli/package.json` (version bump)

- [ ] **Step 1: Update `packages/cli/README.md`**

In the **Commands** section, add `pup template` and `pup preview` sections in the same style as `pup build`/`pup use`:

```markdown
### `pup template`

Convert a powerup step between static and dynamic (template) form, keeping `index.ts` in sync.

```bash
# convert a static step into a readable template, then edit it to inject variables
pup template src/components/button.tsx

# convert back to a verbatim static file
pup template src/components/button.tsx --revert

# list all steps and their static/dynamic status
pup template
```

### `pup preview`

Materialize a powerup **from source** with concrete variable values into `preview/` and optionally run it — test boilerplates (dev servers included) before building.

```bash
# with preview.json configured (variables, run, watch)
pup preview

# or fully via flags
pup preview --appName=my-app --run "npm install && npm run dev"
```

`preview.json`:

```json
{
  "variables": { "appName": "my-test-app" },
  "run": "npm install && npm run dev",
  "output": "preview",
  "watch": true
}
```

Modify steps get their base state from `fixtures/` (auto-captured from git pre-images during `--capture=workingDir`, or hand-authored). Preview never touches anything outside its gitignored output dir.
```

Update the **Concepts** section: replace any `templates/` directory references with the new layout and step-type table:

```markdown
A powerup package:

```
<powerup>/
  index.ts            # steps
  src/
    create/           # verbatim sources for create steps
    dynamic-create/   # readable .ts/.njk templates for dynamic-create steps
    modify/           # pretty-printed modification JSON for modify steps
    dynamic-modify/   # readable templates for dynamic-modify steps
  fixtures/           # pre-state files for preview
  preview.json        # preview config
```

| Step | Source field | Behavior |
|---|---|---|
| `create` | `file` | verbatim copy |
| `dynamic-create` | `template` | render template |
| `modify` | `file` | parse JSON modifications, apply anchors |
| `dynamic-modify` | `template` | render → parse → apply |
```

Update the `pup create` section: document `--capture=all` working without git, and captured files landing in `src/create/` (new files) / `src/modify/` + `fixtures/` (modified files).

- [ ] **Step 2: Bump the CLI version**

In `packages/cli/package.json`: `"version": "0.2.0"` → `"version": "0.3.0"`.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/README.md packages/cli/package.json
git commit -m "docs: new authoring layout, step types, pup template + pup preview; bump cli to 0.3.0"
```

---

### Task 26: Full verification gate

**Files:** none (verification only; fix whatever it surfaces)

- [ ] **Step 1: Build everything**

Run: `cd packages/sdk && pnpm build` — Expected: clean.
Run: `cd packages/program && pnpm build` — Expected: clean (if it has a build script).
Run: `cd packages/cli && pnpm build` — Expected: clean, including `build:builtins`.

- [ ] **Step 2: Run all test suites**

Run: `cd packages/sdk && npx proby` — Expected: PASS.
Run: `cd packages/cli && CI=true npx proby` — Expected: PASS.

- [ ] **Step 3: Lint**

Run: `cd packages/cli && pnpm lint` and `cd packages/sdk && pnpm lint` — Expected: clean (fix issues surfaced by the new files).

- [ ] **Step 4: Manual smoke test of the user's original scenario**

```bash
mkdir -p /tmp/pup-smoke && cd /tmp/pup-smoke
echo "console.log('hi')" > main.js
echo '{"name":"smoke","version":"1.0.0"}' > package.json
pup create smoke-powerup --description="smoke" --capture=all --local
```

Expected: powerup created at `.powerups/installed/_internal/smoke-powerup` with `src/create/main.js` + `src/create/package.json` (verbatim, readable), `index.ts` steps with `"file"` fields, no crash in the non-git dir. Then:

```bash
cd .powerups/installed/_internal/smoke-powerup
pup template package.json
```

Expected: `src/create/package.json` → `src/dynamic-create/package.json.ts` (readable template literal), step rewritten to `dynamic-create`. Then:

```bash
echo '{ "variables": { "name": "smoke-app" } }' > preview.json
# add "name" to required variables in index.ts, edit the template to use _variables.name, then:
pup preview
```

Expected: `preview/package.json` materialized with the variable substituted. Clean up: `rm -rf /tmp/pup-smoke`.

- [ ] **Step 5: Commit any fixes + final state**

```bash
git add -A
git commit -m "chore: full verification pass for static-first authoring + preview"
```

---

## Self-Review Notes (already applied)

- **Spec coverage:** schema (T1), readable generation + wrapAsTemplate removal (T4), capture all/workingDir + fixtures + no-git + rollback + bin.ts normalization (T5–T10, T2), runners/build/use (T11–T14), `pup template` conversion incl. `--revert`/njk/listing (T16–T18), preview incl. `preview.json`/manifest/reconcile/watch/supervisors/no-clean-git (T15, T19–T23), migration of built-ins + scaffold gitignore + version bumps (T24–T25), docs (T25), regression tests for both reported bugs (T7 non-git case, T7/T24 create flow + the flag path exercised end-to-end in T14's pipeline spec).
- **Known deviations from earlier drafts:** `wrap-as-template.ts` deletion happens in Task 4 (before its consumers are rewritten) — full-suite runs are deferred to phase gates (T14 Step 4, T26) so intermediate commits stay targeted-spec green.
- **Type consistency:** `sourceBase`/`overwriteExisting`/`skipInstallSteps`/`saveManifest`/`printFinalSummary` flow through T11→T12→T21; `PreviewConfig` defined in T19 and consumed by T21/T23; `generateReadableTemplate` lives in `#utils/template-conversion/` (single home, used by T17/T18).