# Run Modify Step — Design

## Overview

Add the `modify` step to the new `use` command flow (`use-new.ts`), following the modular pattern established by `run-create-step`. The modify step reads an existing target file, applies a list of modifications (parsed from a modify template), and writes the result back.

This involves three bodies of work:

1. **Shared module move** — relocate `resolve-output-path.ts` from `run-create-step/` to a shared `steps/shared/` directory.
2. **Modify step module** — recreate the modify engine inside `utils/use/`, decomposed into `parse-modify-template.ts`, `apply-modifications.ts`, and an `index.ts` orchestrator.
3. **Printing centralization** — move step summary printing from individual steps into `run-powerup/index.ts`, based on the manifest returned by each step.

## Conventions

Same conventions as the create step spec:

All utilities used by the new `use` flow are created **new inside `utils/use/`**. We do **not** import existing utilities from the broader `utils/` folder (e.g. `utils/modify-engine.ts`). Instead, we recreate them inside `utils/use/` with cleaner names and the coding style established throughout `utils/use/`:

- Destructured object parameters (`{ step, variables }`), not positional
- Full descriptive names — no abbreviations (`modification` not `mod`, `insertionPosition` not `insertPos`)
- Descriptive function names (`applyModifications` not `applyMods`)
- Clean early-return formatting with proper spacing

**Sharing within `utils/use/` is allowed** — sub-modules import from each other and from shared locations via `#utils/use/...` paths.

**External dependencies are fine** — `@rcompat/*`, `@liolocs/powerups-sdk`, `#constants`, `#errors`, `#schemas/modification`, and core platform modules like `#template-runners/index` are imported, not recreated.

**`ResolvedVariable` type** is imported from `#utils/variables` (existing type, same exception as create step).

## Architecture

### Call chain after changes

```
use-new.ts
  → extractVariables({ rawFlags, ... })
  → runPowerup({ ..., variables })
    → runStep({ ..., variables })
      → resolveStepVariables({ step, variables })
      → runModifyStep({ step, isDryRun, destination, powerupDirectory, variables: resolvedVariables })
        → resolveOutputPath({ outputPath, variables })                    // shared, moved from create step
        → parseModifyTemplate({ templatePath, variables })                // new, renders + parses into Modification[]
        → applyModifications({ modifications, outputPath, targetPath })   // new, reads file + applies mods
        → write file + build manifest entry
    → printStepSummary({ manifest })                                       // new, centralized printing
    → saveManifest({ ... })
```

### Files

| File | Action |
|------|--------|
| `utils/use/run-powerup/steps/shared/resolve-output-path.ts` | **Move** from `run-create-step/` |
| `utils/use/run-powerup/steps/shared/resolve-output-path.spec.ts` | **Move** from `run-create-step/` |
| `utils/use/run-powerup/steps/run-create-step/index.ts` | **Modify** — update import path, remove `cli.print` and `cli` import |
| `utils/use/run-powerup/steps/run-modify-step/parse-modify-template.ts` | **New** |
| `utils/use/run-powerup/steps/run-modify-step/parse-modify-template.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-modify-step/apply-modifications.ts` | **New** |
| `utils/use/run-powerup/steps/run-modify-step/apply-modifications.spec.ts` | **New** |
| `utils/use/run-powerup/steps/run-modify-step/index.ts` | **New** |
| `utils/use/run-powerup/steps/run-modify-step/run-modify-step.spec.ts` | **New** |
| `utils/use/run-powerup/run-step.ts` | **Modify** — add `ModifyStep` to union, register `runModifyStep` |
| `utils/use/run-powerup/index.ts` | **Modify** — add `printStepSummary` function, call after each step |

## Shared Module Move

Move `resolve-output-path.ts` and its spec from `run-create-step/` to `run-powerup/steps/shared/`:

```
run-powerup/steps/shared/
  resolve-output-path.ts
  resolve-output-path.spec.ts
```

Update `run-create-step/index.ts` import:

```ts
// from:
import resolveOutputPath from "#utils/use/run-powerup/steps/run-create-step/resolve-output-path";
// to:
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
```

The shared module itself stays unchanged.

## Modify Engine Recreation

Two new modules inside `run-modify-step/`, recreating the logic from `utils/modify-engine.ts` with the coding style conventions. No `errors` parameter is injected — functions throw directly using `use_errors`.

### `parse-modify-template.ts`

Renders the modify template and parses the output into a `Modification[]`. Handles `.json` templates (read directly) vs `.ts`/`.njk` templates (render via `runTemplate`). Throws `modify_template_invalid_json` if the output isn't valid JSON.

```ts
import type { FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import { runTemplate } from "#template-runners/index";
import { modificationArraySchema, type Modification } from "#schemas/modification";
import use_errors from "#errors/useErrors";

export default async function parseModifyTemplate({
  templatePath,
  variables,
}: {
  templatePath: FileRef;
  variables: ResolvedVariable;
}): Promise<Modification[]> {
  const templateExtension = templatePath.extension;
  let templateOutput: string;

  if (templateExtension === ".json") {
    templateOutput = await templatePath.text();
  } else {
    templateOutput = await runTemplate({ templatePath, variables });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(templateOutput);
  } catch {
    throw use_errors.modify_template_invalid_json(templatePath.name);
  }

  return modificationArraySchema.parse(parsed);
}
```

### `apply-modifications.ts`

Applies a `Modification[]` to file content sequentially. Two exported functions:

- `applySingleModification` — applies one modification (top/bottom/replace/after/before). Throws `modify_anchor_not_found` / `modify_anchor_ambiguous` on anchor issues.
- `applyModifications` — reads the target file, applies all modifications in order, returns the modified content. Throws `modify_target_not_found` if the file doesn't exist.

```ts
import fs, { type FileRef } from "@rcompat/fs";
import type { Modification } from "#schemas/modification";
import use_errors from "#errors/useErrors";

export function applySingleModification({
  content,
  modification,
  outputPath,
}: {
  content: string;
  modification: Modification;
  outputPath: string;
}): string {
  const where = modification.where;

  if (where === "top") {
    return modification.content + content;
  }

  if (where === "bottom") {
    return content + modification.content;
  }

  if (typeof where === "string") {
    const matchCount = content.split(where).length - 1;

    if (matchCount === 0) {
      throw use_errors.modify_anchor_not_found(where, outputPath);
    }

    if (matchCount > 1) {
      throw use_errors.modify_anchor_ambiguous(where, outputPath);
    }

    return content.replace(where, modification.content);
  }

  if ("after" in where) {
    const afterIndex = content.indexOf(where.after);

    if (afterIndex === -1) {
      throw use_errors.modify_anchor_not_found(where.after, outputPath);
    }

    const insertionPosition = afterIndex + where.after.length;

    return content.slice(0, insertionPosition) + modification.content + content.slice(insertionPosition);
  }

  if ("before" in where) {
    const beforeIndex = content.indexOf(where.before);

    if (beforeIndex === -1) {
      throw use_errors.modify_anchor_not_found(where.before, outputPath);
    }

    return content.slice(0, beforeIndex) + modification.content + content.slice(beforeIndex);
  }

  return content;
}

export async function applyModifications({
  modifications,
  outputPath,
  targetPath,
}: {
  modifications: Modification[];
  outputPath: string;
  targetPath: FileRef;
}): Promise<string> {
  if (!(await fs.exists(targetPath))) {
    throw use_errors.modify_target_not_found(outputPath);
  }

  const content = await targetPath.text();

  let modifiedContent = content;

  for (const modification of modifications) {
    modifiedContent = applySingleModification({
      content: modifiedContent,
      modification,
      outputPath,
    });
  }

  return modifiedContent;
}
```

Key differences from the original `utils/modify-engine.ts`:
- No `errors` parameter injected — throws directly using `use_errors`
- `applyModifications` takes `targetPath` directly (already resolved by the orchestrator) instead of `rootDir` + `outputPath` string
- Descriptive names: `modification` not `mod`, `insertionPosition` not `insertPos`, `templateExtension` not `ext`

## Orchestrator (`index.ts`)

```ts
import type { ModifyManifestEntry, ModifyStep } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import resolveOutputPath from "#utils/use/run-powerup/steps/shared/resolve-output-path";
import parseModifyTemplate from "#utils/use/run-powerup/steps/run-modify-step/parse-modify-template";
import { applyModifications } from "#utils/use/run-powerup/steps/run-modify-step/apply-modifications";

export default async function runModifyStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: ModifyStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<Omit<ModifyManifestEntry, BaseManifestProperties>> {
  const resolvedOutputPath = resolveOutputPath({
    outputPath: step.outputPath,
    variables,
  });

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

  const templatePath = powerupDirectory.append(`/${step.template}`);
  const targetPath = destination.append(`/${resolvedOutputPath}`);

  try {
    const modifications = await parseModifyTemplate({
      templatePath,
      variables,
    });

    const modifiedContent = await applyModifications({
      modifications,
      outputPath: resolvedOutputPath,
      targetPath,
    });

    const characterCount = modifiedContent.length;

    if (!isDryRun) {
      await fs.create(targetPath.directory);
      await targetPath.write(modifiedContent);
    }

    return {
      ...manifest,
      output: {
        ...manifest.output,
        characterCount,
      },
    };
  } catch {
    return {
      ...manifest,
      status: "skipped-warning",
      output: { type: "none" },
    };
  }
}
```

### Behavior Summary

| Scenario | Parses template? | Reads target? | Applies mods? | Writes? | Status | Output |
|----------|-----------------|---------------|---------------|---------|--------|--------|
| Dry-run — success | Yes | Yes | Yes | No | `applied` | `ModifyOutput` (real char count) |
| Dry-run — target not found | Yes | No | No | No | `skipped-warning` | `NoneOutput` |
| Dry-run — anchor not found | Yes | Yes | Yes (partial) | No | `skipped-warning` | `NoneOutput` |
| Normal — success | Yes | Yes | Yes | Yes | `applied` | `ModifyOutput` |
| Normal — any error | Yes | — | — | No | `skipped-warning` | `NoneOutput` |

### Key Design Decisions

- **Both dry-run and non-dry-run apply modifications** — the only difference is whether the file is written. This gives dry-run an accurate character count and accurate skip-vs-apply result.
- **`action` is always `"modify"`** — the target file must exist for modifications to apply, so the action is always modify.
- **The try/catch wraps everything** — template parsing, file reading, and modification application. Any error → `skipped-warning`. The step never throws, so subsequent steps always continue.
- **No `cli.print`** — printing is centralized in `run-powerup` (see Printing Centralization section).
- **Template-not-found is caught too** — a missing template is treated as a modification error (skip with warning).

## `run-step.ts` Integration

Add `runModifyStep` to the step types registry and update the accepted step union:

```ts
import type { CreateStep, InstallStep, ModifyStep, ManifestEntry, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import runModifyStep from "#utils/use/run-powerup/steps/run-modify-step/index";

const stepTypes: Partial<{ [K in Step["type"]]: StepRunner<Extract<Step, { type: K }>> }> = {
  create: runCreateStep,
  modify: runModifyStep,
  // delete: runDeleteStep,
  // read: runReadStep,
  install: runInstallStep,
};

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: InstallStep | CreateStep | ModifyStep;
  // ... rest unchanged
```

Two changes:
1. Import `runModifyStep` and register it in `stepTypes`
2. Add `ModifyStep` to the accepted `step` union type

## Printing Centralization

Move step summary printing from individual steps into `run-powerup/index.ts`, based on the manifest returned by each step.

### Changes to `run-powerup/index.ts`

```ts
import cli from "@rcompat/cli";
import type { ManifestEntry } from "@liolocs/powerups-sdk";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";

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

    printStepSummary({ manifest });

    if (!isDryRun && manifest) {
      await saveManifest({ destination: powerupDirectory, manifest });
    }
  }
}

function printStepSummary({
  manifest,
}: {
  manifest: Omit<ManifestEntry, BaseManifestProperties>;
}): void {
  const { stepName, status, output } = manifest;

  if (status === "skipped-warning") {
    cli.print(`Skipped: ${stepName}\n`);
    return;
  }

  if (output.type === "create") {
    cli.print(`Created: ${output.path}\n`);
    return;
  }

  if (output.type === "modify") {
    cli.print(`Modified: ${output.path}\n`);
    return;
  }

  if (output.type === "install") {
    cli.print(`Installed dependencies\n`);
    return;
  }
}
```

### Changes to `run-create-step/index.ts`

Remove the `cli` import and the `cli.print` call. The dry-run branch falls through (does nothing, returns manifest):

```ts
// Before:
if (isDryRun) {
  cli.print(`${resolvedOutputPath} (${characterCount} chars)\n`);
} else {
  await fs.create(targetPath.directory);
  await targetPath.write(renderedContent);
}

// After:
if (!isDryRun) {
  await fs.create(targetPath.directory);
  await targetPath.write(renderedContent);
}
```

### What this means

- Both create and modify steps stop printing — they just return the manifest
- `run-powerup` prints one line per step based on the manifest's `status` and `output.type`
- Skipped steps print `Skipped: <stepName>`
- Applied create steps print `Created: <path>`
- Applied modify steps print `Modified: <path>`
- Install steps print `Installed dependencies`
- Printing happens for both dry-run and non-dry-run

Note: the skipped-warning line is generic — it doesn't include the specific error message because the manifest doesn't carry that detail. Adding an optional message field would require an SDK schema change, which is out of scope.

## Testing

### `parse-modify-template.spec.ts`
- Parses a `.json` modify template directly into `Modification[]`
- Renders and parses a `.ts` modify template with variables
- Throws `modify_template_invalid_json` when template output is not valid JSON

### `apply-modifications.spec.ts`
- Prepends content with `where: "top"`
- Appends content with `where: "bottom"`
- Replaces a unique exact-string match
- Inserts after an anchor
- Inserts before an anchor
- Applies multiple modifications in array order sequentially
- Throws `modify_anchor_not_found` when exact string not found
- Throws `modify_anchor_ambiguous` when exact string appears multiple times
- Throws `modify_anchor_not_found` when after/before anchor not found
- Throws `modify_target_not_found` when target file doesn't exist

### `run-modify-step.spec.ts`
- Applies modifications to an existing file and returns `applied` manifest with `ModifyOutput`
- Returns `skipped-warning` + `NoneOutput` when target file doesn't exist
- Returns `skipped-warning` + `NoneOutput` when an anchor is not found in the target file
- Returns `skipped-warning` + `NoneOutput` when template doesn't exist
- Returns `skipped-warning` + `NoneOutput` when template produces invalid JSON
- Dry-run applies modifications (gets real char count) but does NOT write the file
- Different variable values produce different output paths
- Creates parent directories that don't exist yet when writing

### `resolve-output-path.spec.ts` (moved, unchanged)
- Same tests as before — resolves `{{var}}` tokens, case-insensitive, leaves unresolved as-is

### Existing tests to verify
- `run-create-step/run-create-step.spec.ts` — still passes after import path change and `cli.print` removal
- `run-install-step/run-install-step.spec.ts` — unaffected