# Fix CLI Package TypeScript Build Errors

## Problem

Running `pnpm local` fails during the `tsgo` type-check step of the CLI package build. There are 19 TypeScript errors across 9 files, all in `packages/cli`. The errors fall into three root-cause buckets:

1. **Config schema mismatch** — The SDK's `PowerupConfig` defines `packages: string[]`, but the real config format (already implemented in the CLI's `config.ts`) supports both string and object entries (`{ package: string, powerups?: { include?, exclude? } }`). Code that handles both forms has type errors because the type only allows strings.

2. **Discriminated union narrowing** — Production code and tests access union-specific properties without narrowing on the discriminator. The most significant instance is an `Omit`-on-union pattern in the manifest construction pipeline that loses the correlation between `stepType` and `output`.

3. **Broad JSON types** — `.json()` returns `JSONValue | null`; code that casts or accesses properties on this type without an intermediate `unknown` cast or a proper type annotation fails.

## Approach

**Approach C: Full type-safety for production code, pragmatic narrowing for test code.**

- Fix the SDK config schema to match reality (root cause for bucket 1)
- Unify config validation by running all config reads through the SDK's zod schema (bucket 1)
- Replace dynamic step dispatch with switch/case and move manifest construction into narrowed branches (bucket 2, production)
- Use type narrowing and casts in spec files (buckets 2 and 3, tests)
- Use `as unknown as` for the unavoidable JSON-to-typed-array cast in `save-manifest.ts` (bucket 3, production)

**Zero type assertions in production code** — the only `as unknown as` is for a JSON file read, which is unavoidable. The manifest construction pipeline is fully type-safe by construction.

## Design

### Section 1: SDK — Update config schema and exports

**File: `packages/sdk/src/private/schema/config.ts`**

Replace `packages: zod.array(zod.string())` with a schema that matches the real config format:

```ts
const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    powerups: zod.object({
      include: zod.array(zod.string()).optional(),
      exclude: zod.array(zod.string()).optional(),
    }).optional(),
  }),
]);

export const powerupConfigSchema = zod.object({
  packages: zod.array(packageEntrySchema).default([]),
});

export type PackageEntry = zod.infer<typeof packageEntrySchema>;
export type PowerupConfig = zod.infer<typeof powerupConfigSchema>;
```

The `.default([])` on `packages` ensures a config file without a `packages` key validates to `[]`, matching the current behavior of `readConfig` (`raw.packages ?? []`).

**File: `packages/sdk/src/private/index.ts`**

Add `packageEntrySchema` and `type PackageEntry` to the exports from `#schema/config`.

### Section 2: CLI — Unify config types and validation

The SDK's `PowerupConfig`/`PackageEntry` become the single source of truth. The CLI's `config.ts` is **not touched** — it is scheduled for removal when the install command is refactored. Its local `PackageEntry` type is structurally compatible with the SDK's and will simply be deleted later.

#### 2b. `getConfig.ts` — Add schema validation

Currently returns `configRef.json()` with no validation. Add `powerupConfigSchema.parse()`:

```ts
import { powerupConfigSchema, type PowerupConfig } from "@liolocs/powerups-sdk";

export async function getConfig(configRef: FileRef): Promise<PowerupConfig> {
  if (await configRef.exists() === false) {
    throw use_errors.config_not_found();
  }

  try {
    return powerupConfigSchema.parse(await configRef.json());
  } catch {
    throw use_errors.config_invalid_file();
  }
}
```

#### 2c. `checkForPowerupInConfig/index.ts` — Use `getConfig` instead of raw `.json()`

Replace each `await localConfigRef.json()` / `await globalConfigRef.json()` with `await getConfig(localConfigRef)` / `await getConfig(globalConfigRef)`. Drop the `PowerupConfig` type annotations (now inferred from `getConfig`'s return type). The existence checks remain for branching logic.

#### 2d. `getPowerupInstallFromConfig.ts` — Inline `getPackageSource`, handle object entries

Do **not** import from `#utils/config` (that module is scheduled for removal). Recreate the helper locally:

```ts
import { type PackageEntry } from "@liolocs/powerups-sdk";

function getPackageSource(entry: PackageEntry): string {
  return typeof entry === "string" ? entry : entry.package;
}
```

Then:

```ts
const found = config.packages.find(
  pkg => getPackageSource(pkg).split(":")[1] === powerupName,
);

if (is.falsy(found)) {
  throw use_errors.not_in_config(powerupName);
}

return {
  where: determineInstallationType(getPackageSource(found!)),
};
```

#### 2e. `getIsPowerupInConfig.ts` — No code change needed

The function already handles both string and object entries (`typeof p === "string" ? p : p.package`). With the updated `PowerupConfig` type, `p` is `PackageEntry`, so the else branch is no longer `never`. The type error resolves automatically.

### Section 3: Step dispatch and manifest construction

#### 3a. `run-step.ts` — Switch/case dispatch, return full `ManifestEntry`

**Remove:**
- `StepRunner` type (only used locally, not imported elsewhere)
- `StepRunArgs` type (only used locally, not imported elsewhere)
- `stepTypes` map (replaced by switch)

**Change:**
- `StepRunnerResult.manifest` from `Omit<ManifestEntry, BaseManifestProperties>` to `ManifestEntry`
- `runStep` gains 4 new params: `powerupName`, `powerupVersion`, `powerupLocation`, `powerupType`
- Body becomes a switch on `step.type`

**Keep:**
- `BaseManifestProperties` export (all 5 step runners depend on it)
- `StepRunnerResult` export (new shape)

```ts
export type StepRunnerResult = {
  manifest: ManifestEntry;
  variableUpdate?: { name: string; value: string };
};

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
  powerupName,
  powerupVersion,
  powerupLocation,
  powerupType,
}: {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
  powerupName: string;
  powerupVersion: string;
  powerupLocation: string;
  powerupType: "multi-use" | "single-use";
}): Promise<StepRunnerResult> {
  const stepVariables = resolveStepVariables({ step, variables });

  const base = {
    powerupName,
    version: powerupVersion,
    location: powerupLocation,
    type: powerupType,
  };

  switch (step.type) {
    case "create": {
      const result = await runCreateStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
    }
    case "modify": {
      const result = await runModifyStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
    }
    case "delete": {
      const result = await runDeleteStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
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
      const result = await runInstallStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
    }
    default:
      throw use_errors.unsupported_step_type(step.type);
  }
}
```

**Why this is type-safe:** Inside each `case`, `result.manifest` is a single concrete type (e.g., `Omit<CreateManifestEntry, BaseManifestProperties>`). Spreading it with `base` (which has exactly the 4 omitted keys) reconstructs `CreateManifestEntry` — TypeScript can verify this property-by-property. The `base` object is defined once outside the switch to avoid repeating the 4 properties in every case.

> Fallback: if TypeScript doesn't resolve `{ ...result.manifest, ...base }` cleanly to `CreateManifestEntry` in practice, list the 4 properties explicitly in each case (`powerupName, version: powerupVersion, location: powerupLocation, type: powerupType`). Same type safety, slightly more verbose.

#### 3b. `run-powerup/index.ts` — Pass base properties through, drop the spread

**Remove:**
- `import type { BaseManifestProperties }` (no longer used here)
- The `fullManifest` variable and the spread that constructs it

**Change:**
- Pass the 4 base properties into `runStep`
- Use `manifest` directly (it is already a full `ManifestEntry`)

```ts
for (const step of steps) {
  const { manifest, variableUpdate } = await runStep({
    step,
    isDryRun,
    destination,
    powerupDirectory,
    variables,
    powerupName: instructions.name,
    powerupVersion,
    powerupLocation,
    powerupType: instructions.type,
  });

  if (is.truthy(variableUpdate)) {
    variables[variableUpdate!.name] = variableUpdate!.value;
  }

  printStepSummary({ manifest });

  if (!isDryRun && is.truthy(manifest)) {
    await saveManifest({ destination, manifest });
  }
}
```

`printStepSummary` and `saveManifest` now take `manifest` directly. No assertion anywhere in the pipeline.

### Section 4: Remaining fixes (JSON casts + test narrowing)

#### 4a. `save-manifest.ts` — Fix JSON cast with `unknown` intermediate

```ts
const existing = await ref.json() as unknown as ManifestEntry[];
```

This is the only `as unknown as` in production code. It is unavoidable because `.json()` returns `JSONValue` which does not overlap with `ManifestEntry[]`.

#### 4b. `compile-index-file.spec.ts` — Cast `.json()` result

```ts
const pkgJson = await packageDir.append("/package.json").json() as {
  keywords: string[];
  powerup: { instructions: string };
};
```

#### 4c. `create-instructions-json-file.spec.ts` — Narrow by `step.type`

```ts
const createdStep = createdInstructionsJson.steps[0];
const originalStep = instructions.steps[0];

assert(createdStep.type).equals(originalStep.type);
assert(createdStep.name).equals(originalStep.name);

if (createdStep.type === "create" && originalStep.type === "create") {
  assert(createdStep.template).equals(originalStep.template);
  assert(createdStep.outputPath).equals(originalStep.outputPath);
}
```

#### 4d. `save-manifest.spec.ts` — Narrow by `output.type`

```ts
const output = entries[0].output;

assert(output.type).equals("create");

if (output.type === "create") {
  assert(output.path).equals("src/App.tsx");
  assert(output.action).equals("create");
  assert(output.characterCount).equals(412);
}
```

#### 4e. `get-list-of-issues-with-instructions.spec.ts` — Type the `steps` array to prevent widening

```ts
import { type Instructions, type Step } from "@liolocs/powerups-sdk";

const steps: Step[] = [
  { type: "read", name: "pkg", path: "{{random}}.json", as: "pkgName", jsonPath: "name" },
  { type: "create", name: "comp", template: "comp.ts.ts", outputPath: "src/{{random}}.ts" },
];
```

## Files changed

| File | Section | Change |
|------|---------|--------|
| `packages/sdk/src/private/schema/config.ts` | 1 | New `packageEntrySchema`, updated `powerupConfigSchema`, export `PackageEntry` |
| `packages/sdk/src/private/index.ts` | 1 | Export `packageEntrySchema`, `PackageEntry` |
| `packages/cli/.../getConfig.ts` | 2b | Add `powerupConfigSchema.parse()` validation |
| `packages/cli/.../check-for-powerup-in-config/index.ts` | 2c | Use `getConfig()` instead of raw `.json()` |
| `packages/cli/.../getPowerupInstallFromConfig.ts` | 2d | Inline `getPackageSource`, handle object entries |
| `packages/cli/.../getIsPowerupInConfig.ts` | 2e | No code change (type resolves automatically) |
| `packages/cli/.../run-step.ts` | 3a | Switch/case dispatch, accept base props, return full `ManifestEntry` |
| `packages/cli/.../run-powerup/index.ts` | 3b | Pass base props through, drop spread + `BaseManifestProperties` import |
| `packages/cli/.../save-manifest.ts` | 4a | `as unknown as ManifestEntry[]` |
| `packages/cli/.../compile-index-file.spec.ts` | 4b | Cast `.json()` result |
| `packages/cli/.../create-instructions-json-file.spec.ts` | 4c | Narrow by `step.type` |
| `packages/cli/.../save-manifest.spec.ts` | 4d | Narrow by `output.type` |
| `packages/cli/.../get-list-of-issues-with-instructions.spec.ts` | 4e | Type `steps` as `Step[]` |

**13 files across 2 packages. 0 type assertions in production code** (the only `as unknown as` is in `save-manifest.ts` for a JSON file read, which is unavoidable).

## Out of scope

- The CLI's `config.ts` module is not modified. It defines its own local `PackageEntry` and `Config` types that are structurally compatible with the SDK's updated types. This module is scheduled for removal when the install command is refactored.
- Unifying `config.ts`'s `readConfig`/`readGlobalConfig` with `getConfig` into a single code path. This would be part of the install refactor, not this fix.
- Adding new test cases for object-entry config handling in `getPowerupInstallFromConfig.spec.ts`. The existing tests only use string entries; adding object-entry tests is an enhancement, not a fix.