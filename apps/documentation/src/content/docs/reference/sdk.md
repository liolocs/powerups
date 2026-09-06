---
title: SDK reference
description: The @liolocs/powerups-sdk API — schemas, types, defineInstructions, and includePowerup.
---

The authoring SDK for Powerups — the schema, types, and helpers that powerup
authors use to define and compose instructions.

A powerup is a small package that, when applied with `pup use`, runs a sequence
of steps (`create`, `modify`, `delete`, `read`, `install`) against a target
project to scaffold or transform code. This package gives you:

- **`instructionsSchema`** — the single source of truth for what an
  `Instructions` object may contain (validated at build time).
- **`defineInstructions`** — wraps your instructions object together with its
  source location so the build tool and `includePowerup` can resolve templates
  and record provenance.
- **`includePowerup`** — flattens another powerup's steps into the current one
  at **author time**, so a parent powerup can compose children and ship as one
  self-contained unit.

## Installation

```sh
pnpm add -D @liolocs/powerups-sdk
```

The SDK is a build-time / author-time dependency only. It is inlined into the
CLI at bundle time, so end users never need to install it.

## Exports

```ts
import {
  // schemas
  instructionsSchema,
  powerupPropertySchema,
  // types
  type Instructions,
  type Step,
  type StepOverrideValue,
  type PowerupProperty,
  // helpers
  defineInstructions,
  includePowerup,
} from "@liolocs/powerups-sdk";
```

---

## Schemas

### `instructionsSchema`

A `.strict()` Zod schema describing a complete powerup definition. Use it
implicitly via `defineInstructions` (the build command validates for you), or
explicitly when you want to validate an instructions object by hand:

```ts
import { instructionsSchema } from "@liolocs/powerups-sdk";

const parsed = instructionsSchema.parse(myInstructions); // throws on unknown keys
```

It is `.strict()`, so any key not in the schema — including the legacy
`include` step and `packageDependencies` field — is **rejected** rather than
silently stripped.

The shape it validates:

```ts
{
  name: string,
  type: "multi-use" | "single-use",
  description: string,
  variables: {
    required: string[],
    optional?: string[],     // defaults to [] at runtime
  },
  intent: string[],
  steps: Step[],             // one of create | modify | delete | read | install
}
```

### `powerupPropertySchema`

The schema for the `powerup` field in a powerup package's `package.json`. It
tells the build command where the TypeScript entry lives and (optionally)
declares compatibility constraints:

```ts
{
  instructions: string,                       // e.g. "index.ts"
  compatibility?: Record<string, unknown>,    // optional, forward-declared
}
```

A typical `package.json` excerpt:

```json
{
  "powerup": { "instructions": "index.ts", "compatibility": {} }
}
```

> The CLI additionally consumes a separate `powerups.active` map (the runtime
> registry in a container package); that map is **not** this schema. This schema
> describes the single `powerup` property on the powerup package itself.

---

## Types

### `Instructions`

The full instructions object, inferred from `instructionsSchema`. Every
powerup's default export is built from one of these.

### `Step`

A discriminated union of the five step kinds. Each carries an optional
`variableMap`, an optional `__source` (set by `includePowerup`, stripped before
`instructions.json` is written), and an optional `from` (provenance for
single-use enforcement). The step kinds:

| `type`     | Required fields                                        | Notes                                            |
|------------|--------------------------------------------------------|--------------------------------------------------|
| `create`   | `name`, `template`, `outputPath`                       | Renders a template to a new file.                |
| `modify`   | `name`, `template`, `outputPath`                       | Renders a template and merges it into the file.  |
| `delete`   | `name`, `outputPath`                                   | Removes a file.                                  |
| `read`     | `name`, `path`, `as`                                   | Reads a file/JSON value into the variable scope. |
| `install`  | `name`, plus any of `dependencies` / `devDependencies` / `peerDependencies` | Runs a package install inline. |

### `StepOverrideValue`

The shape of a per-step override accepted by `includePowerup`'s `stepOverride`
option. It mirrors a step's fields **except `name`** (the name is always taken
from the original step so the override can be keyed by it). You supply one
variant matching the step's `type`:

```ts
type StepOverrideValue =
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
```

### `PowerupProperty`

The inferred type of `powerupPropertySchema` — the `powerup` field in a powerup
package's `package.json`.

---

## `defineInstructions`

```ts
function defineInstructions<I extends Instructions>(
  instructions: I,
  source: string,
): { instructions: I; source: string }
```

Wraps an `Instructions` object together with the module's source URL. This is
the **required** shape for a powerup's default export — the build command and
`includePowerup` both expect `{ instructions, source }`, not a raw
`Instructions` object.

- **`instructions`** — your full instructions object. Pass it as an inline
  literal (not via a `: Instructions` annotation) so the `const` generic
  parameter `I` captures the literal tuple types of `variables.required` and the
  step `name` strings. That literal capture is what gives `includePowerup` its
  type-safety on `variables`, `excludeSteps`, and `stepOverride` keys.
- **`source`** — the module URL of the entry file. Always pass
  `import.meta.url`. It records where the powerup's own templates live so the
  build command can find and copy them, and so `includePowerup` can stamp
  provenance onto flattened steps.

### Usage

```ts
import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

const instructions = {
  name: "cli-command",
  type: "multi-use" as const,
  description: "Scaffold a CLI command",
  variables: { required: ["commandName", "description"], optional: ["flags"] },
  intent: ["create a new CLI command"],
  steps: [
    {
      type: "create",
      name: "command",
      template: "templates/command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    // ...more steps
  ],
} satisfies Instructions;

export default defineInstructions(instructions, import.meta.url);
```

The build command (`pup build`) validates `instructions` against
`instructionsSchema`, compiles the entry, and writes a self-contained
`dist/instructions.json` (with `__source` stripped) alongside the compiled
templates.

---

## `includePowerup`

```ts
function includePowerup<I extends Instructions>(
  child: { instructions: I; source: string },
  options: {
    variables: { [K in I["variables"]["required"][number]]: string }
              & { [K in NonNullable<I["variables"]["optional"]>[number]]?: string };
    excludeSteps?: I["steps"][number]["name"][];
    stepOverride?: Record<string, StepOverrideValue>;
    namespace?: string;
  },
): Step[]
```

Flattens another powerup's steps into the current powerup at **author time**.
It returns an array of `Step` objects that you spread into the parent's
`steps`. The child powerup must already be built (its `dist/` must exist) and
imported as its default export.

This is the replacement for the old `include` step type. Instead of a runtime
indirection that loads and runs a child powerup separately, `includePowerup`
inlines the child's steps into the parent *now*, and the parent's build bundles
the child's templates into the parent's `dist/_internal/`. The result is a
single self-contained powerup with no runtime dependency on its children.

### What it does to each child step

For every child step that is **not** in `excludeSteps`:

1. **Renames it** to `<namespace>:<originalName>` so all step names in the
   parent's `steps` array stay unique.
2. **Rewrites its `template`** to `_internal/<namespace>/<originalTemplate>`
   (unless the template already starts with `_internal/`, i.e. it came from a
   transitive include). The build command copies the child's templates into
   that path inside the parent's `dist/`.
3. **Composes a `variableMap`** mapping each of the child's variable names to
   the value you supplied in `options.variables`. At runtime, the engine
   resolves each step's `outputPath`/`template` against this map, so a child
   that references `{{commandName}}` can be wired to the parent's
   `{{commandName}}` (or to a literal, or to a different parent variable).
   Parent-supplied mappings go first; any `variableMap` the child step already
   carried (from a transitive include) goes last, so transitive variable chains
   resolve correctly.
4. **Stamps provenance**: `from: { name: child.instructions.name, singleUse }`
   (used for single-use enforcement across includes) and `__source` (the child's
   source URL, or a grandchild's if the step itself came from a deeper include).
   `__source` is stripped before `instructions.json` is written; `from` is kept.

### Options

- **`variables`** *(required)* — a map from each of the child's **required**
  variable names to a template string (or literal). The type enforces that every
  required variable is present and keys are valid child variable names; optional
  variables may be supplied too. Values are templates like `"{{commandName}}"`,
  literals like `"[]"`, or any string the runtime can resolve.
- **`excludeSteps`** — child step names to drop. Use it when the parent already
  provides a step that would collide semantically (e.g. the parent has its own
  `command` step, so exclude the child's `command` step to avoid scaffolding it
  twice). Keys are checked against the child's real step names.
- **`stepOverride`** — a map from child step name to a partial step replacement
  (a `StepOverrideValue`). The override keeps the original step's `name` and
  `type` and replaces the rest, so you can repoint a child's `template` or
  `outputPath` without rewriting the whole step.
- **`namespace`** — the prefix used for renamed steps and the `_internal/`
  template path. Defaults to `child.instructions.name`.

### Why `namespace` is necessary

Because `includePowerup` flattens child steps into **one shared `steps` array**
and **one shared `dist/_internal/` tree**, two inclusions can collide in two
places:

- **Template paths.** Each flattened step's `template` becomes
  `_internal/<namespace>/templates/...` and the build copies the child's
  templates there. Two inclusions sharing a namespace would write into the same
  directory and the second copy would overwrite the first — silently corrupting
  templates. The namespace gives each inclusion its own directory.
- **Step names.** Flattened steps are renamed `<namespace>:<name>`, and they all
  live in one `steps` array. Build-time validation requires unique step names,
  and the manifest records per-step outcomes by name. Two children with
  same-named steps, or the *same child included twice*, would collide without
  the prefix.

The default (`child.instructions.name`) is fine when every child is included
once and their names differ. The explicit `namespace` option is **required** in
one case: **including the same child more than once** — for example, a parent
that scaffolds two subcommands from a single `cli-sub-command` powerup:

```ts
steps: [
  ...includePowerup(cliSubCommand, {
    namespace: "subcommand-1",            // distinct, or templates/steps collide
    variables: { /* ... */ },
  }),
  ...includePowerup(cliSubCommand, {
    namespace: "subcommand-2",
    variables: { /* ... */ },
  }),
],
```

Without distinct namespaces, the two inclusions would both write to
`_internal/cli-sub-command/` and both produce `cli-sub-command:*` step names,
clobbering each other at build time.

When each child is included once with unique names, an explicit `namespace` is
optional — it just yields cleaner paths (e.g. `_internal/command/…` vs
`_internal/cli-command/…`) and more readable namespaced step names.

### Full example

A parent powerup that composes two children:

```ts
import {
  defineInstructions,
  includePowerup,
  type Instructions,
} from "@liolocs/powerups-sdk";
import cliCommand from "cli-command";
import cliSubCommand from "cli-sub-command";

const instructions: Instructions = {
  name: "cli-with-sub-commands",
  type: "multi-use",
  description: "Scaffold a CLI with subcommands",
  variables: {
    required: [
      "commandName", "description",
      "subcommandName", "subcommandDescription",
      "subcommandFlags", "subcommandErrorCases",
    ],
    optional: ["errorCases"],
  },
  intent: ["create a command and subcommands for a CLI"],
  steps: [
    // the parent's own step, using its own template
    {
      type: "create",
      name: "parent-command.ts",
      template: "templates/parent-command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    // include cli-command, but drop the steps the parent already provides
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
    // include cli-sub-command, wired to the parent's variables
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

After `pup build`, the parent's `dist/` is fully self-contained:

```
dist/
  index.js
  instructions.json
  templates/parent-command.ts              # the parent's own template
  _internal/command/templates/errors.ts    # bundled from cli-command
  _internal/command/templates/barrel.ts
  _internal/subcommand/templates/subcommand.ts        # bundled from cli-sub-command
  _internal/subcommand/templates/subcommand-spec.ts
  _internal/subcommand/templates/modify-errors.ts
```

`instructions.json` contains the flattened, namespaced steps — each carrying its
`variableMap` and `from` provenance — and no runtime reference to the child
packages. Applying the parent with `pup use` runs every included step as if it
were native to the parent, and the manifest records one entry for the parent
plus one for each included powerup (for single-use enforcement).
