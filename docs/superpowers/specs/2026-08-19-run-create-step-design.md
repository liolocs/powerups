# Run Create Step — Design

## Overview

Revamp the `create` step in the new `use` command flow (`use-new.ts`) to match the modular pattern established by `run-install-step`. This involves two bodies of work:

1. **Plumbing** — threading variables from the command through `runPowerup` → `runStep` → step runners, with `variableMap` resolution at the `runStep` level.
2. **Create step module** — decomposed into focused sub-modules (`resolve-output-path.ts`, `render-template.ts`, `index.ts`), each with its own spec.

## Conventions

All utilities used by the new `use` flow are created **new inside `utils/use/`**. We do **not** import existing utilities from the broader `utils/` folder (e.g. `resolveTemplateString`, `extractVariables`). Instead, we recreate them inside `utils/use/` with cleaner names and the coding style established throughout `utils/use/`:

- Destructured object parameters (`{ step, variables }`), not positional
- Full descriptive names — no abbreviations (`variableMap` not `map`, `stepVariables` not `stepVars`)
- Descriptive function names (`applyVariablesToTemplateString` not `resolveTemplateString`)
- Clean early-return formatting with proper spacing

**The only exception** is sharing **within `utils/use/`** itself — sub-modules import from each other via `#utils/use/...` paths (the same pattern used in `check-for-pre-use-errors/`).

**External dependencies are fine** — `@rcompat/*`, `@liolocs/powerups-sdk`, `#constants`, `#errors`, and core platform modules like `#template-runners/index` (which contains complex runtime-specific code for Bun/Deno/Node) are imported, not recreated.

## Architecture

### Call chain after changes

```
use-new.ts
  → extractVariables({ rawFlags, ... })          // new, inside utils/use/
  → runPowerup({ ..., variables })
    → runStep({ ..., variables })
      → resolveStepVariables({ step, variables })   // new, inside utils/use/run-powerup/
      → runCreateStep({ step, isDryRun, destination, powerupDirectory, variables: resolvedVariables })
        → resolveOutputPath({ outputPath, variables })           // new, inside run-create-step/
        → renderTemplate({ template, powerupDirectory, variables })  // new, inside run-create-step/
        → write file + build manifest entry
```

### Files

| File | Action |
|------|--------|
| `utils/use/apply-variables-to-template-string.ts` | **New** — recreated from `utils/resolve-template-string.ts` with cleaner name |
| `utils/use/apply-variables-to-template-string.spec.ts` | **New** |
| `utils/use/extract-variables.ts` | **New** — recreated from `utils/variables.ts` with coding style from `utils/use/` |
| `utils/use/extract-variables.spec.ts` | **New** |
| `commands/use/use-new.ts` | Modify — extract variables using new `extractVariables`, pass to `runPowerup` |
| `utils/use/run-powerup/index.ts` | Modify — accept `variables`, pass to `runStep` |
| `utils/use/run-powerup/run-step.ts` | Modify — accept `variables`, resolve `variableMap`, pass resolved variables to step runners |
| `utils/use/run-powerup/resolve-step-variables.ts` | **New** — recreated from `execute-steps.ts` |
| `utils/use/run-powerup/resolve-step-variables.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/index.ts` | Modify — implement `runCreateStep` orchestrator |
| `utils/use/run-powerup/steps/run-create-step/resolve-output-path.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/resolve-output-path.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/render-template.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/render-template.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/run-create-step.spec.ts` | **New** |

## Plumbing Changes

### New shared utilities (inside `utils/use/`)

#### `apply-variables-to-template-string.ts`

Recreated from `utils/resolve-template-string.ts`. Resolves `{{var}}` tokens in a string using the variables record. Case-insensitive matching, unresolved tokens left as-is.

```ts
import type { ResolvedVariable } from "#utils/use/resolved-variable";

export default function applyVariablesToTemplateString({
  templateString,
  variables,
}: {
  templateString: string;
  variables: ResolvedVariable;
}): string {
  return templateString.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    const key = Object.keys(variables).find(
      matchedKey => matchedKey.toLowerCase() === token.toLowerCase(),
    );

    return key !== undefined ? variables[key] : match;
  });
}
```

#### `extract-variables.ts`

Recreated from `utils/variables.ts`. Extracts variables from raw CLI flags, normalizes to camelCase, validates required variables, applies defaults for optional ones.

```ts
import is from "@rcompat/is";
import type { ResolvedVariable } from "#utils/use/resolved-variable";

export default function extractVariables({
  rawFlags,
  required,
  optional,
  excludeFlags,
  defaults,
  onMissing,
}: {
  rawFlags: { flag: string; value: string }[];
  required: string[];
  optional: string[];
  excludeFlags: string[];
  defaults?: Record<string, string>;
  onMissing: (missing: string[]) => never;
}): ResolvedVariable {
  const variableFlags = rawFlags.filter(
    flag => !excludeFlags.includes(flag.flag),
  );

  const result: ResolvedVariable = {};
  for (const flag of variableFlags) {
    const key = normalizeFlagName(flag.flag);
    result[key] = flag.value;
  }

  const missing: string[] = [];
  for (const declared of required) {
    const matched = Object.keys(result).find(
      key => key.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      missing.push(declared);
    }
  }
  if (missing.length > 0) {
    onMissing(missing);
  }

  for (const declared of optional) {
    const matched = Object.keys(result).find(
      key => key.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      result[declared] = defaults?.[declared] ?? "";
    }
  }

  return result;
}
```

(`normalizeFlagName` is a private helper within the same file, same logic as the original.)

### Layer 1: `use-new.ts`

The command destructures `{ context, subcommands, flags, rawFlags }`. After obtaining `validatedCompiledInstructions`, extract variables using the new `extractVariables` from `#utils/use/extract-variables`:

```ts
const EXCLUDE_FLAGS = ["--dry-run", "-d", "--help", "-h"];

// ... after validatedCompiledInstructions:
const variables = extractVariables({
  rawFlags: rawFlags ?? [],
  required: validatedCompiledInstructions.variables.required,
  optional: validatedCompiledInstructions.variables.optional ?? [],
  excludeFlags: EXCLUDE_FLAGS,
  defaults: validatedCompiledInstructions.variables.defaults ?? {},
  onMissing: (missing) => {
    throw use_errors.missing_variables(missing, validatedCompiledInstructions.variables.required, powerupName!);
  },
});

await runPowerup({
  destination: root,
  powerupDirectory: powerup.location,
  instructions: validatedCompiledInstructions,
  isDryRun,
  variables,
});
```

### Layer 2: `run-powerup/index.ts`

`runPowerup` gains a `variables: ResolvedVariable` parameter and passes it to `runStep`:

```ts
export default async function runPowerup({
  destination,
  powerupDirectory,
  instructions,
  isDryRun,
  variables,
}: {
  destination: FileRef;
  powerupDirectory: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
  variables: ResolvedVariable;
}): Promise<void> {
  const steps = instructions.steps;

  for (const step of steps) {
    const manifest = await runStep({ step, isDryRun, destination, powerupDirectory, variables });

    if (!isDryRun && manifest) {
      await saveManifest({ destination: powerupDirectory, manifest });
    }
  }
}
```

### Layer 3: `run-powerup/run-step.ts`

`runStep` gains a `variables: ResolvedVariable` parameter. Before dispatching to a step runner, it resolves the step's `variableMap` via `resolveStepVariables` and passes the resolved variables through.

```ts
type StepRunner<S extends Step> = (args: {
  step: S;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}) => Promise<Omit<ManifestEntry, BaseManifestProperties>>;

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: InstallStep | CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<Omit<ManifestEntry, BaseManifestProperties>> {
  const stepType = step.type;
  const runStepFunction = stepTypes[stepType];

  if (is.truthy(runStepFunction)) {
    const stepVariables = resolveStepVariables({ step, variables });
    return runStepFunction!({ step, isDryRun, destination, powerupDirectory, variables: stepVariables });
  } else {
    throw use_errors.unsupported_step_type(step.type);
  }
}
```

The install step (`runInstallStep`) does not need changes — TypeScript allows a function with fewer destructured parameters to satisfy a type with more parameters, so it ignores `variables` and `powerupDirectory`.

### `resolve-step-variables.ts` (new file)

Recreated from `execute-steps.ts` with cleaner naming and formatting, using the new `applyVariablesToTemplateString`:

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";

export function resolveStepVariables({
  step,
  variables,
}: {
  step: Step;
  variables: ResolvedVariable;
}): ResolvedVariable {
  const variableMap = (step as Step & { variableMap?: Record<string, string> }).variableMap;

  if (!variableMap) {
    return variables;
  }

  const stepVariables: ResolvedVariable = { ...variables };

  for (const [location, value] of Object.entries(variableMap)) {
    stepVariables[location] = applyVariablesToTemplateString({ templateString: value, variables: stepVariables });
  }

  return stepVariables;
}
```

## Create Step Modules

### `resolve-output-path.ts`

Resolves `{{var}}` tokens in the step's `outputPath` using the step variables, via the new `applyVariablesToTemplateString`:

```ts
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";

export default function resolveOutputPath({
  outputPath,
  variables,
}: {
  outputPath: string;
  variables: ResolvedVariable;
}): string {
  return applyVariablesToTemplateString({ templateString: outputPath, variables });
}
```

### `render-template.ts`

Handles template-exists check + rendering. Throws `template_not_found` if the template file doesn't exist in the powerup directory. Uses `runTemplate` from `#template-runners/index` (core platform module, not recreated):

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import { runTemplate } from "#template-runners/index";
import use_errors from "#errors/useErrors";

export default async function renderTemplate({
  template,
  powerupDirectory,
  variables,
}: {
  template: string;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<string> {
  const templatePath = powerupDirectory.append(`/${template}`);

  if (!(await fs.exists(templatePath))) {
    throw use_errors.template_not_found(template);
  }

  return runTemplate({ templatePath, variables });
}
```

### `index.ts` (orchestrator)

```ts
import type { CreateManifestEntry, CreateStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/run-create-step/resolve-output-path";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";

export default async function runCreateStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<Omit<CreateManifestEntry, BaseManifestProperties>> {
  const resolvedOutputPath = resolveOutputPath({
    outputPath: step.outputPath,
    variables,
  });

  const renderedContent = await renderTemplate({
    template: step.template,
    powerupDirectory,
    variables,
  });

  const characterCount = renderedContent.length;

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
        characterCount,
      },
  }

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if (await fs.exists(targetPath)) {
    return {
      ...manifest,
      status: "skipped-warning",
      output: { type: "none" },
    }
  }

  if (isDryRun) {
    cli.print(`${resolvedOutputPath} (${characterCount} chars)\n`);
  } else {
    await fs.create(targetPath.directory);
    await targetPath.write(renderedContent);
  }

  return manifest;
}
```

## Behavior Summary

| Scenario | Renders template? | Writes file? | Prints? | Status | Output |
|----------|-------------------|-------------|---------|--------|--------|
| Dry-run — file doesn't exist | Yes | No | Yes (path + char count) | `applied` | `CreateOutput` |
| Dry-run — file already exists | Yes | No | No | `skipped-warning` | `NoneOutput` |
| Normal — file doesn't exist | Yes | Yes | No | `applied` | `CreateOutput` |
| Normal — file already exists | Yes | No | No | `skipped-warning` | `NoneOutput` |
| Template not found | — | — | — | Throws `template_not_found` | — |

**Note:** In the "file already exists" case, the template is still rendered before discovering the file exists. This keeps the flow simple — render first, then check destination. Reordering to check destination first would save a render call in the skip case but would diverge the dry-run and skip paths.

## Testing

### `apply-variables-to-template-string.spec.ts`
- Resolves `{{var}}` tokens in a string
- Case-insensitive matching (`{{ComponentName}}` matches key `componentName`)
- Leaves unresolved tokens as-is

### `extract-variables.spec.ts`
- Extracts variables from raw flags, normalizing to camelCase
- Calls `onMissing` when required variables are absent
- Applies defaults for optional variables not provided
- Filters out excluded flags

### `resolve-output-path.spec.ts`
- Resolves `{{var}}` tokens in a path string
- Leaves unresolved tokens as-is
- Case-insensitive matching

### `render-template.spec.ts`
- Renders a `.ts` template with variables successfully
- Throws `template_not_found` when template file doesn't exist

### `run-create-step.spec.ts`
- Writes a file to the correct resolved path and returns `applied` manifest with `CreateOutput`
- Skips with `skipped-warning` + `NoneOutput` when destination file already exists
- Dry-run + file doesn't exist → returns `applied` manifest with `CreateOutput`, prints summary line, does NOT write the file
- Dry-run + file already exists → returns `skipped-warning` + `NoneOutput`, does NOT print, does NOT write
- Different variable values produce different output paths and content
- Creates parent directories that don't exist yet

### `resolve-step-variables.spec.ts`
- Returns variables unchanged when no `variableMap`
- Applies `variableMap` mappings, resolving template strings in values
- Nested variable references in `variableMap` values resolve correctly

## Open Items

- **`ResolvedVariable` type location:** A `utils/use/resolved-variable.ts` file is referenced in the imports above. This is a simple interface (`{ [key: string]: string }`) that needs to be created. It could also be defined inline in each file, but a shared type file avoids duplication. The existing `VariableResult` in `utils/variables.ts` is not imported — per conventions, we create a new `ResolvedVariable` inside `utils/use/`.
- **`powerupDir` → `powerupDirectory` rename:** The new code uses `powerupDirectory` for descriptive naming consistency. The existing `run-step.ts` and `runPowerup` use `powerupDir`. These should be renamed for consistency, which touches the install step's signature as well (even though it ignores the param).
- **`runTemplate` import:** `runTemplate` from `#template-runners/index` is imported as a core platform dependency (it contains complex runtime-specific code for Bun/Deno/Node). It is not recreated inside `utils/use/`. If this should be recreated instead, flag it.