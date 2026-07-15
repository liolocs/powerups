# Implementation Plan: Optional Variables in Instruction Schema

**Spec:** `docs/superpowers/specs/2026-07-15-optional-variables-design.md`

## Overview

Change the instruction schema's `variables` field from a flat string array to an object with `required` and `optional` arrays. Update all consumers: variable extraction, error messages, validation, apply/create commands, and the existing `instructions.json` file.

---

## Additional File Discovered During Research

The spec lists 6 source files and 4 test files. Research revealed **2 additional files** that also reference `instructions.variables` as an array and must be updated:

- `packages/cli/src/private/utils/validate-output.ts` — references `subInstructions.variables` (line 65) and `instructions.variables` (line 80) as arrays
- `packages/cli/src/private/utils/validate-output.spec.ts` — all fixtures use old format

Plus these test files with old-format fixtures not in the spec:

- `packages/cli/src/private/utils/check-output.spec.ts` — all fixtures use `variables: ["..."]`
- `packages/cli/src/private/utils/resolve.spec.ts` — all fixtures use `variables: ["..."]`

**Total: 8 source files + 7 test/data files = 15 files to touch.**

---

## Phase 1: Schema Change

**File:** `packages/cli/src/private/schemas/instruction.ts`

### Step 1.1: Change `variables` field in `instructionsSchema`

Replace:
```ts
variables: p.array(p.string),
```
With:
```ts
variables: p({
  required: p.array(p.string),
  optional: p.array(p.string).optional(),
}),
```

The inferred `Instructions` type changes from `variables: string[]` to `variables: { required: string[]; optional?: string[] }`.

`suboutputSchema` stays unchanged — its `variables: p.record(p.string, p.string)` is a key-value mapping, not a declaration array.

---

## Phase 2: Variable Extraction Refactor

**File:** `packages/cli/src/private/utils/variables.ts`

### Step 2.1: Remove `findMissingVariables`

Delete the `findMissingVariables` function entirely (lines 39–55). Its logic is folded into `extractVariables`.

### Step 2.2: Rewrite `extractVariables` with object params

Replace the entire `extractVariables` function with:

```ts
export function extractVariables(args: {
  rawFlags: { flag: string; value: string }[];
  required: string[];
  optional: string[];
  excludeFlags: string[];
  onMissing: (missing: string[]) => never;
}): VariableResult {
  const { rawFlags, required, optional, excludeFlags, onMissing } = args;

  // 1. Filter out excluded flags
  const variableFlags = rawFlags.filter(f => !excludeFlags.includes(f.flag));

  // 2. Build camelCase key/value record
  const result: VariableResult = {};
  for (const f of variableFlags) {
    const key = normalizeFlagName(f.flag);
    result[key] = f.value;
  }

  // 3. Validate required: collect ALL missing, then call onMissing once
  const missing: string[] = [];
  for (const declared of required) {
    const matched = Object.keys(result).find(
      k => k.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      missing.push(declared);
    }
  }
  if (missing.length > 0) {
    onMissing(missing);
  }

  // 4. Optional: if provided, use the value; if not, default to ""
  for (const declared of optional) {
    const matched = Object.keys(result).find(
      k => k.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      result[declared] = "";
    }
  }

  return result;
}
```

Key changes:
- Object params instead of positional
- `onMissing` receives `string[]` (all missing) instead of `(variable, flagName)` per-item
- Optional variables default to `""` when not provided
- `findMissingVariables` removed

`normalizeFlagName` and `toKebabCase` remain unchanged and exported.

---

## Phase 3: Error Message Update

**File:** `packages/cli/src/private/errors/outputApplyErrors.ts`

### Step 3.1: Add import for `toKebabCase`

Add to imports:
```ts
import { toKebabCase } from "#utils/variables";
```

### Step 3.2: Replace `missing_variable` with `missing_variables`

Replace the `missing_variable` error:
```ts
missing_variable: (variable: string, flagName: string) => {
  const errorText =
    `Missing required variable: ${variable}\n` +
    `Provide it with --${flagName}=<value>`;
  return t`${errorBGText}${errorText}`;
},
```

With:
```ts
missing_variables: (
  missing: string[],
  required: string[],
  domain: string,
  name: string,
) => {
  const missingList = missing.join(", ");
  const requiredList = required
    .map(v => `  --${toKebabCase(v)}=<value>`)
    .join("\n");
  const example = `${CLI_NAME} ${domain} apply ${name} ${
    required.map(v => `--${toKebabCase(v)}=<value>`).join(" ")
  }`;
  const errorText =
    `Missing required variables: ${missingList}\n` +
    `\nAll required variables:\n${requiredList}\n` +
    `\nExample:\n  ${example}`;
  return t`${errorBGText}${errorText}`;
},
```

### Step 3.3: No changes to error code exports

The `OutputTemplateApplyErrorCode` and `OutputFeatureApplyErrorCode` are derived via `Object.fromEntries(Object.keys(...))` — they auto-update to `missing_variables` (plural).

---

## Phase 4: Validation Updates

### Step 4.1: `packages/cli/src/private/utils/check-output.ts`

After the `instructionsSchema.parse` succeeds (after the `try/catch` block), add two new validation checks before the existing template existence checks:

```ts
// Validate variable declarations
const required = instructions.variables.required;
const optional = instructions.variables.optional ?? [];

// a) Required/optional name collision
for (const opt of optional) {
  const collision = required.some(r => r.toLowerCase() === opt.toLowerCase());
  if (collision) {
    issues.push(`variable "${opt}" is declared as both required and optional`);
  }
}

// b) Optional variable used in an output path
const pathVariables = new Set<string>();
for (const file of [...instructions.output.create, ...instructions.output.modify]) {
  for (const [, token] of file.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
    pathVariables.add(token);
  }
}
for (const file of instructions.output.delete ?? []) {
  for (const [, token] of file.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
    pathVariables.add(token);
  }
}
for (const pathVar of pathVariables) {
  const isOptionalVar = optional.some(v => v.toLowerCase() === pathVar.toLowerCase());
  if (isOptionalVar) {
    issues.push(
      `variable "${pathVar}" is used in an output path but declared optional; it should be required`,
    );
  }
}
```

These run before the template existence checks and suboutput tree validation. If the schema is broken (parse fails), we return early as before.

### Step 4.2: `packages/cli/src/private/utils/validate-output.ts`

Two references to `instructions.variables` need updating:

**Change 1 (line ~65):** Iterate over both required and optional suboutput variables:
```ts
// Before:
for (const declared of subInstructions.variables) {

// After:
const subAllVariables = [
  ...subInstructions.variables.required,
  ...(subInstructions.variables.optional ?? []),
];
for (const declared of subAllVariables) {
```

**Change 2 (line ~80):** Check against both required and optional parent variables:
```ts
// Before:
const declared = instructions.variables.find(
  v => v.toLowerCase() === varName.toLowerCase(),
);

// After:
const allParentVariables = [
  ...instructions.variables.required,
  ...(instructions.variables.optional ?? []),
];
const declared = allParentVariables.find(
  v => v.toLowerCase() === varName.toLowerCase(),
);
```

---

## Phase 5: Command Updates

### Step 5.1: `packages/cli/src/private/commands/output/apply/index.ts`

**Update the `extractVariables` call (step 6 in the action handler):**

Replace:
```ts
const variables = extractVariables(
  rawFlags ?? [],
  instructions.variables,
  EXCLUDE_FLAGS,
  (variable, flagName) => {
    throw errors.missing_variable(variable, flagName);
  },
);
```

With:
```ts
const variables = extractVariables({
  rawFlags: rawFlags ?? [],
  required: instructions.variables.required,
  optional: instructions.variables.optional ?? [],
  excludeFlags: EXCLUDE_FLAGS,
  onMissing: (missing) => {
    throw errors.missing_variables(missing, instructions.variables.required, domain, name);
  },
});
```

### Step 5.2: `packages/cli/src/private/commands/output/create/index.ts`

**Add `--optional-variables` flag:**

Add after the existing `--variables` flag entry:
```ts
{
  name: "optionalVariables",
  long: "optional-variables",
  short: "ov",
  description: "Comma-separated optional variable names",
},
```

**Update the action handler:**

Replace:
```ts
const variables = is.defined(flags.variables) === true
  ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
  : [];
```

With:
```ts
const required = is.defined(flags.variables) === true
  ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
  : [];
const optional = is.defined(flags.optionalVariables) === true
  ? flags.optionalVariables.split(",").map(s => s.trim()).filter(Boolean)
  : [];
```

**Update the instructions object construction:**

Replace `variables` in the `instructions` object:
```ts
// Before:
const instructions = { name, variables, intent, packageDependencies, output };

// After:
const instructions = {
  name,
  variables: {
    required,
    ...(optional.length > 0 ? { optional } : {}),
  },
  intent,
  packageDependencies,
  output,
};
```

---

## Phase 6: Data Migration

### Step 6.1: `.saved/output/template/cli-command/instructions.json`

Replace:
```json
"variables": [
  "name",
  "description",
  "sub",
  "subDescription"
],
```

With:
```json
"variables": {
  "required": ["name", "description"],
  "optional": ["sub", "subDescription"]
},
```

Note: The `sub` create file has `outputPath: ".../{{sub}}.ts"` which uses `{{sub}}` in a path. Per the new validation, an optional variable in a path would be flagged. However, since `sub` is genuinely optional (the user may not want a subcommand), this is the intended design — the template author accepts that the `sub` file will be created with an empty `{{sub}}` if not provided, or they should make it required. For now, we follow the spec: `sub` and `subDescription` are optional. The validation check in `check-output.ts` would flag this, but since this is the actual `.saved` folder (not a test), the user can address it as they see fit.

**Actually — reconsider:** The `sub` file's outputPath contains `{{sub}}` which IS in a path. Per the design, this should be a validation issue. The user said "if a variable is in an output path our validation command should warn that this should be a required variable." So the validation will flag this. The user will see this when they run `validate` or `doctor`. That's the intended behavior — the validation tells the user about the issue, and they decide whether to make it required or accept the broken path.

So we keep `sub` as optional and let validation flag it. The user can then move it to required if they want.

---

## Phase 7: Test Updates

### Step 7.1: `packages/cli/src/private/schemas/instruction.spec.ts`

**All test fixtures need updating.** Every occurrence of `variables: ["..."]` or `variables: []` must become `variables: { required: ["..."] }` or `variables: { required: [] }`.

Specific occurrences (by test case):
- "should parse instructions with includes": `variables: ["theme"]` → `variables: { required: ["theme"] }`
- "should parse instructions without includes (backward compat)": `variables: ["ComponentName"]` → `variables: { required: ["ComponentName"] }`
- "should parse includes without optional outputPathOverride": `variables: ["theme"]` → `variables: { required: ["theme"] }`
- "should parse includes with both create and modify outputPathOverride": `variables: ["theme"]` → `variables: { required: ["theme"] }`
- "should parse output with both create and modify entries": `variables: ["name"]` → `variables: { required: ["name"] }`
- "should parse output with a delete array": `variables: []` → `variables: { required: [] }`
- "should parse output without delete (backward compat)": `variables: []` → `variables: { required: [] }`
- "should parse packageDependencies with target (monorepo)": `variables: []` → `variables: { required: [] }`
- "should parse packageDependencies without target (normal repo)": `variables: []` → `variables: { required: [] }`
- "should parse multiple packageDependencies groups": `variables: []` → `variables: { required: [] }`
- "should parse instructions without packageDependencies (backward compat)": `variables: []` → `variables: { required: [] }`
- "should parse includes with outputPathOverride.delete": `variables: []` → `variables: { required: [] }`
- "should parse output with create, modify, and delete together": `variables: ["name"]` → `variables: { required: ["name"] }`
- All rejection test cases: `variables: []` → `variables: { required: [] }`

**Add new test cases:**
- Parse instructions with both required and optional variables: `variables: { required: ["name"], optional: ["sub"] }` — assert `result.variables.required` and `result.variables.optional`
- Parse instructions with required only (optional omitted): `variables: { required: ["name"] }` — assert `result.variables.optional` is `undefined`
- Parse instructions with empty required and some optional: `variables: { required: [], optional: ["sub"] }`
- Reject old array format: `variables: ["name"]` should throw (clean break)

### Step 7.2: `packages/cli/src/private/utils/variables.spec.ts`

**Update imports:** Remove `findMissingVariables` from imports (if imported). Keep `normalizeFlagName`, `toKebabCase`, `extractVariables`.

**Update `throwMissing` mock:**
```ts
// Before:
function throwMissing(variable: string, _flagName: string): never {
  throw new Error(`Missing required variable: ${variable}`);
}

// After:
function throwMissing(missing: string[]): never {
  throw new Error(`Missing required variables: ${missing.join(", ")}`);
}
```

**Update all `extractVariables` calls to object params:**

Every test that calls `extractVariables(positional, args, ...)` changes to `extractVariables({ rawFlags, required, optional, excludeFlags, onMissing })`.

Example transformation:
```ts
// Before:
extractVariables(
  [{ flag: "--component-name", value: "Button" }, { flag: "--theme", value: "dark" }],
  ["ComponentName", "theme"],
  ["--dry-run", "-d", "--help", "-h"],
  throwMissing,
)

// After:
extractVariables({
  rawFlags: [{ flag: "--component-name", value: "Button" }, { flag: "--theme", value: "dark" }],
  required: ["ComponentName", "theme"],
  optional: [],
  excludeFlags: ["--dry-run", "-d", "--help", "-h"],
  onMissing: throwMissing,
})
```

**Update the "should throw on a missing declared variable" test:**
```ts
// Before: asserts message includes "Missing required variable: ComponentName"
// After: asserts message includes "Missing required variables: ComponentName"
// Also: missing should be collected — if two are missing, both should appear
```

**Add new test cases:**
- Optional variable defaults to `""` when not provided
- Optional variable uses provided value when given
- All missing required variables are collected (not just first) — pass no flags, expect error lists all required names
- Mixed: some required provided, some missing — only missing ones in error
- Optional variable provided as flag is NOT defaulted to `""`

### Step 7.3: `packages/cli/src/private/commands/output/apply/apply.spec.ts`

**Update test error code reference:**

The test "should fail with missing_variable when a required variable is omitted" references `OutputTemplateApplyErrorCode.missing_variable`. This changes to `missing_variables`.

```ts
// Before:
assert((e as CodeError).code).equals(OutputTemplateApplyErrorCode.missing_variable);

// After:
assert((e as CodeError).code).equals(OutputTemplateApplyErrorCode.missing_variables);
```

**Update the test name:** "should fail with missing_variable..." → "should fail with missing_variables..."

**Update the error assertion:** The error message now lists all missing variables and includes an example. If the test checks message content, update accordingly. Currently it only checks the error code, so the name change is the main update.

**Update all `writeJSON` calls that directly write `instructions.json` with old format:**

In the "apply composite output" test group, several tests write instructions.json directly via `writeJSON`. Update all:
- `variables: ["theme"]` → `variables: { required: ["theme"] }`
- `variables: []` → `variables: { required: [] }`

Specific locations:
- "should write files from parent and suboutputs": parent's writeJSON has `variables: ["theme"]`
- "should print all outputs without writing with --dry-run": parent's writeJSON has `variables: []`
- "should fail with invalid_composition for a missing suboutput": writeJSON has `variables: []`
- "should write to overridden location with output path override": writeJSON has `variables: []`
- "should write both sets of files when same suboutput is used twice": writeJSON has `variables: []`
- "should warn and skip when the anchor appears multiple times": writeJSON has `variables: []`
- "should apply delete and warn on failed modify (non-atomic)": writeJSON has `variables: []`
- "should delete alongside create and modify in one run" — this uses `createCmd.run` with `--variables`, not direct writeJSON, so it's fine (create command writes new format)

**Add a new test case:**
- Apply with optional variables not provided — verify the optional variable resolves to empty string in output
- Apply with optional variables provided — verify the value is used

### Step 7.4: `packages/cli/src/private/commands/output/create/create.spec.ts`

**Update assertion in "create template creates empty files for create and modify entries":**

```ts
// Before:
assert(content.variables).equals(["ComponentName"]);

// After:
assert(content.variables.required).equals(["ComponentName"]);
assert(content.variables.optional).undefined();
```

**Add new test cases:**
- Create with `--optional-variables` / `-ov` flag — verify `instructions.json` has `variables.optional` set
- Create with `--optional-variables` empty — verify `optional` is omitted from JSON
- Create with both `--variables` and `--optional-variables` — verify both arrays in output

### Step 7.5: `packages/cli/src/private/utils/validate-output.spec.ts`

**Update ALL fixtures** — every `writeOutput` call has `variables: [...]` that must become `variables: { required: [...] }`.

Specific test cases and their updates:
- "valid tree with no includes": `variables: ["ComponentName"]` → `variables: { required: ["ComponentName"] }`
- "valid tree with one suboutput": button has `variables: ["componentName", "theme"]` → `variables: { required: ["componentName", "theme"] }`; parent has `variables: ["theme"]` → `variables: { required: ["theme"] }`
- "valid nested suboutputs": all three (a, b, c) have `variables: ["val"]` → `variables: { required: ["val"] }`
- "missing suboutput": `variables: []` → `variables: { required: [] }`
- "circular reference": both a-cycle, b-cycle have `variables: []` → `variables: { required: [] }`
- "deep circular reference": all three have `variables: []` → `variables: { required: [] }`
- "diamond shape": all three have `variables: []` → `variables: { required: [] }`
- "unmapped variable": child has `variables: ["componentName", "theme"]` → `variables: { required: ["componentName", "theme"] }`; parent has `variables: []` → `variables: { required: [] }`
- "invalid parentVar reference": child has `variables: ["val"]` → `variables: { required: ["val"] }`; parent has `variables: ["theme"]` → `variables: { required: ["theme"] }`
- "create override file not found": both have `variables: []` → `variables: { required: [] }`
- "modify override file not found": both have `variables: []` → `variables: { required: [] }`
- "delete override file not found": both have `variables: []` → `variables: { required: [] }`
- "valid delete override": both have `variables: []` → `variables: { required: [] }`
- "same suboutput referenced twice": child has `variables: ["componentName"]` → `variables: { required: ["componentName"] }`; parent has `variables: []` → `variables: { required: [] }`
- "unparseable instructions": parent has `variables: []` → `variables: { required: [] }`

**Add new test case:**
- Valid tree where suboutput has optional variables and parent doesn't map them — should NOT report "unmapped variable" for optional variables

### Step 7.6: `packages/cli/src/private/utils/check-output.spec.ts`

**Update ALL fixtures** — every `writeOutput` call and inline `writeJSON` has `variables: [...]` that must become `variables: { required: [...] }`.

Specific test cases:
- "valid output with no includes": `variables: ["ComponentName"]` → `variables: { required: ["ComponentName"] }`
- "missing instructions.json": no variables (no instructions.json written)
- "schema parse failure": no variables (invalid JSON)
- "missing create template file": `variables: []` → `variables: { required: [] }`
- "missing modify template file": `variables: []` → `variables: { required: [] }`
- "valid output with both create and modify": `variables: []` → `variables: { required: [] }` (inline writeJSON)
- "valid output with valid suboutputs": child has `variables: ["componentName"]` → `variables: { required: ["componentName"] }`; parent has `variables: []` → `variables: { required: [] }`
- "merge suboutput issues": child has `variables: ["componentName"]` → `variables: { required: ["componentName"] }`; parent has `variables: []` → `variables: { required: [] }`

**Add new test cases:**
- Required/optional collision: `variables: { required: ["name"], optional: ["name"] }` → assert issue contains "declared as both required and optional"
- Optional variable in output path: `variables: { required: [], optional: ["name"] }` with `outputPath: "src/{{name}}.ts"` → assert issue contains "used in an output path but declared optional"
- Optional variable NOT in output path: `variables: { required: ["name"], optional: ["sub"] }` with no `{{sub}}` in any path → assert no issues
- Collision check is case-insensitive: `required: ["Name"]`, `optional: ["name"]` → issue

### Step 7.7: `packages/cli/src/private/utils/resolve.spec.ts`

**Update ALL fixtures** — every `writeOutput` call has `variables: [...]` that must become `variables: { required: [...] }`.

All test cases use `writeOutput` with inline instructions objects. The `variables` field appears in every output definition. Transform each:
- `variables: ["componentName"]` → `variables: { required: ["componentName"] }`
- `variables: ["name"]` → `variables: { required: ["name"] }`
- `variables: ["componentName", "theme"]` → `variables: { required: ["componentName", "theme"] }`
- `variables: ["theme"]` → `variables: { required: ["theme"] }`
- `variables: ["val"]` → `variables: { required: ["val"] }`
- `variables: ["variant"]` → `variables: { required: ["variant"] }`
- `variables: []` → `variables: { required: [] }`

No new test cases needed for resolve.spec.ts — the resolve logic doesn't change, only the schema format does.

---

## Phase 8: Verification

### Step 8.1: Run tests

```bash
cd packages/cli && npx proby
```

All tests should pass. Key areas to watch:
- `instruction.spec.ts` — schema parsing
- `variables.spec.ts` — extractVariables behavior
- `check-output.spec.ts` — new validation checks
- `validate-output.spec.ts` — suboutput tree validation
- `resolve.spec.ts` — output resolution
- `apply.spec.ts` — end-to-end apply with variables
- `create.spec.ts` — create command with new flags

### Step 8.2: Run linter

```bash
cd packages/cli && npm run lint
```

### Step 8.3: Manual smoke test (optional)

If possible, test the apply command with the migrated `cli-command` template:
```bash
saved template apply cli-command --name=test-cmd --description="Test command"
```

This should succeed without requiring `--sub` or `--subDescription`.

---

## Implementation Order (Dependency-Safe)

1. **Schema** (`instruction.ts`) — foundation, no dependencies
2. **Variables** (`variables.ts`) — depends on nothing but types flow from schema
3. **Errors** (`outputApplyErrors.ts`) — depends on `toKebabCase` from variables.ts (already exported)
4. **check-output.ts** — depends on schema types
5. **validate-output.ts** — depends on schema types
6. **apply/index.ts** — depends on variables.ts + errors
7. **create/index.ts** — depends on schema types
8. **Migrate** `instructions.json` — depends on schema change
9. **Tests** — update all 7 test files
10. **Run tests** — verify everything works

---

## Summary of All Files

### Source files (8):
1. `packages/cli/src/private/schemas/instruction.ts`
2. `packages/cli/src/private/utils/variables.ts`
3. `packages/cli/src/private/errors/outputApplyErrors.ts`
4. `packages/cli/src/private/utils/check-output.ts`
5. `packages/cli/src/private/utils/validate-output.ts`
6. `packages/cli/src/private/commands/output/apply/index.ts`
7. `packages/cli/src/private/commands/output/create/index.ts`
8. `.saved/output/template/cli-command/instructions.json`

### Test files (7):
9. `packages/cli/src/private/schemas/instruction.spec.ts`
10. `packages/cli/src/private/utils/variables.spec.ts`
11. `packages/cli/src/private/utils/check-output.spec.ts`
12. `packages/cli/src/private/utils/validate-output.spec.ts`
13. `packages/cli/src/private/utils/resolve.spec.ts`
14. `packages/cli/src/private/commands/output/apply/apply.spec.ts`
15. `packages/cli/src/private/commands/output/create/create.spec.ts`

### Files NOT changed (confirmed):
- `packages/cli/src/private/utils/resolve.ts` — empty string flows through naturally
- `packages/cli/src/private/utils/resolve-template-string.ts` — already handles any string value
- `packages/cli/src/private/commands/doctor.ts` — uses checkOutput/instructionsSchema, no direct `.variables` array access
- `packages/cli/src/private/commands/output/validate/index.ts` — uses checkOutput, no direct `.variables` array access
- `packages/cli/src/private/commands/doctor.spec.ts` — uses createCmd.run, doesn't write instructions.json directly
- `packages/cli/src/private/commands/output/search/index.ts` — doesn't reference variables
- `packages/cli/src/private/commands/output/template.ts` — composition command, doesn't reference variables
- `packages/cli/src/private/commands/output/feature.ts` — composition command, doesn't reference variables
- `suboutputSchema` in `instruction.ts` — stays as `p.record(p.string, p.string)`