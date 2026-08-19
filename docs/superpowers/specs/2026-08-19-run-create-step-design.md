# Run Create Step — Design

## Overview

Revamp the `create` step in the new `use` command flow (`use-new.ts`) to match the modular pattern established by `run-install-step`. This involves two bodies of work:

1. **Plumbing** — threading variables from the command through `runPowerup` → `runStep` → step runners, with `variableMap` resolution at the `runStep` level.
2. **Create step module** — decomposed into focused sub-modules (`resolve-output-path.ts`, `render-template.ts`, `index.ts`), each with its own spec.

## Architecture

### Call chain after changes

```
use-new.ts
  → extractVariables(rawFlags, instructions.variables)
  → runPowerup({ ..., variables })
    → runStep({ ..., variables })
      → resolveStepVariables({ step, variables })   // handles variableMap
      → runCreateStep({ step, isDryRun, destination, powerupDirectory, variables: resolvedVariables })
        → resolveOutputPath({ outputPath, variables })
        → renderTemplate({ template, powerupDirectory, variables })
        → write file + build manifest entry
```

### Files

| File | Action |
|------|--------|
| `commands/use/use-new.ts` | Modify — extract variables, pass to `runPowerup` |
| `utils/use/run-powerup/index.ts` | Modify — accept `variables`, pass to `runStep` |
| `utils/use/run-powerup/run-step.ts` | Modify — accept `variables`, resolve `variableMap`, pass resolved variables to step runners |
| `utils/use/run-powerup/resolve-step-variables.ts` | **New** — relocated from `execute-steps.ts` |
| `utils/use/run-powerup/resolve-step-variables.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/index.ts` | Modify — implement `runCreateStep` orchestrator |
| `utils/use/run-powerup/steps/run-create-step/resolve-output-path.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/resolve-output-path.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/render-template.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/render-template.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-create-step/run-create-step.spec.ts` | **New** |

## Plumbing Changes

### Layer 1: `use-new.ts`

The command destructures `{ context, subcommands, flags, rawFlags }`. After obtaining `validatedCompiledInstructions`, extract variables:

```ts
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
```

An `EXCLUDE_FLAGS` constant is defined for the flags that should not be treated as variables (e.g. `--dry-run`, `-d`, `--help`, `-h`).

Pass `variables` to `runPowerup`.

### Layer 2: `run-powerup/index.ts`

`runPowerup` gains a `variables: VariableResult` parameter and passes it to `runStep`:

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
  variables: VariableResult;
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

`runStep` gains a `variables: VariableResult` parameter. Before dispatching to a step runner, it resolves the step's `variableMap` via `resolveStepVariables` and passes the resolved variables through.

```ts
type StepRunner<S extends Step> = (args: {
  step: S;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: VariableResult;
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
  variables: VariableResult;
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

Moved from `execute-steps.ts` with cleaner naming and formatting:

```ts
export function resolveStepVariables({
  step,
  variables,
}: {
  step: Step;
  variables: VariableResult;
}): VariableResult {
  const variableMap = (step as Step & { variableMap?: Record<string, string> }).variableMap;

  if (!variableMap) {
    return variables;
  }

  const stepVariables: VariableResult = { ...variables };

  for (const [location, value] of Object.entries(variableMap)) {
    stepVariables[location] = applyVariablesToTemplateString(value, stepVariables);
  }

  return stepVariables;
}
```

## Create Step Modules

### `resolve-output-path.ts`

Resolves `{{var}}` tokens in the step's `outputPath` using the step variables:

```ts
export default function resolveOutputPath({
  outputPath,
  variables,
}: {
  outputPath: string;
  variables: VariableResult;
}): string {
  return applyVariablesToTemplateString(outputPath, variables);
}
```

### `render-template.ts`

Handles template-exists check + rendering. Throws `template_not_found` if the template file doesn't exist in the powerup directory:

```ts
export default async function renderTemplate({
  template,
  powerupDirectory,
  variables,
}: {
  template: string;
  powerupDirectory: FileRef;
  variables: VariableResult;
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
  variables: VariableResult;
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

  if (isDryRun) {
    cli.print(`${resolvedOutputPath} (${characterCount} chars)\n`);

    return {
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
    };
  }

  const targetPath = destination.append(`/${resolvedOutputPath}`);

  if (await fs.exists(targetPath)) {
    return {
      timestamp: new Date(),
      stepName: step.name,
      from: step.from?.name,
      stepType: "create",
      status: "skipped-warning",
      output: { type: "none" },
    };
  }

  await fs.create(targetPath.directory);
  await targetPath.write(renderedContent);

  return {
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
  };
}
```

## Behavior Summary

| Scenario | Renders template? | Writes file? | Prints? | Status | Output |
|----------|-------------------|-------------|---------|--------|--------|
| Dry-run | Yes | No | Yes (path + char count) | `applied` | `CreateOutput` |
| Normal — file doesn't exist | Yes | Yes | No | `applied` | `CreateOutput` |
| Normal — file already exists | Yes | No | No | `skipped-warning` | `NoneOutput` |
| Template not found | — | — | — | Throws `template_not_found` | — |

**Note:** In the "file already exists" case, the template is still rendered before discovering the file exists. This keeps the flow simple — render first, then check destination. Reordering to check destination first would save a render call in the skip case but would diverge the dry-run and skip paths.

## Testing

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
- Dry-run returns manifest with `CreateOutput` and does NOT write the file
- Different variable values produce different output paths and content
- Creates parent directories that don't exist yet

### `resolve-step-variables.spec.ts`
- Returns variables unchanged when no `variableMap`
- Applies `variableMap` mappings, resolving template strings in values
- Nested variable references in `variableMap` values resolve correctly

## Open Items

- **`powerupDir` → `powerupDirectory` rename:** The new code uses `powerupDirectory` for descriptive naming consistency. The existing `run-step.ts` and `runPowerup` use `powerupDir`. These should be renamed for consistency, but the rename touches the install step's signature as well (even though it ignores the param).
- **`resolveTemplateString` → `applyVariablesToTemplateString` rename:** The existing utility is named `resolveTemplateString`. The cleaner name `applyVariablesToTemplateString` is used in the `resolveStepVariables` function. This rename is optional but improves readability.
- **`EXCLUDE_FLAGS` in `use-new.ts`:** The new command doesn't currently have `--overwrite` or `--type` flags. The exclude list should only include flags that actually exist in the new command (`--dry-run`, `-d`, `--help`, `-h`).