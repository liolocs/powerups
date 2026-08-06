# Build Command Design

## Purpose

Prepare a powerup for distribution by compiling its TypeScript instructions
source into a `dist/instructions.json` file and copying referenced template
files into `dist/`, producing a self-contained distributable.

## Invocation

```
pup build
```

No arguments. Runs from the powerup's own directory (like `npm run build`).
Reads `package.json` from the current working directory.

## Overview & File Structure

### New CLI files

- `src/commands/build.ts` — thin wrapper re-exporting from private
- `src/private/commands/build/index.ts` — the command implementation
- `src/private/commands/build/build.spec.ts` — tests
- `src/private/errors/buildErrors.ts` — error factory (matching the pattern of
  all other error files)

### Command registration

Add `build` to `src/commands/index.ts` (import + array entry).

### SDK changes

- New schema file: `packages/sdk/src/private/schema/powerup.ts` — a zod schema
  for the `powerup` property in a powerup's `package.json`
- Uncomment/add exports in `packages/sdk/src/private/index.ts`:
  ```ts
  export { powerupPropertySchema, type PowerupProperty } from "#schema/powerup";
  export { instructionsSchema, type Instructions, type Step } from "#schema/instructions";
  ```
- Add `@liolocs/powerups-sdk` as a `workspace:^` dependency in the CLI's
  `package.json`

### No changes to existing code

The build command is purely additive. The CLI's pema-based
`instructionsSchema` stays in place for now (used by `use`, `validate`,
`info`); the build command uses the SDK's zod schema. The eventual migration
of other commands to the SDK schema is a separate effort.

## Reading & Validating package.json

The command reads `package.json` from cwd using `@rcompat/fs` and
`@rcompat/runtime`.

### Powerups package guard

Before doing anything else, confirm this is a powerups package by checking the
`keywords` array for the `powerups-package` keyword (`KEYWORD_PACKAGE`
constant):

```ts
const cwd = runtime.cwd();
const packageJsonRef = cwd.append(`/${PACKAGE_FILE}`);

if (!(await packageJsonRef.exists())) {
  throw build_errors.no_package_json();
}

const pkgJson = await packageJsonRef.json();

const keywords = pkgJson.keywords;
if (!Array.isArray(keywords) || !keywords.includes(KEYWORD_PACKAGE)) {
  throw build_errors.not_a_powerups_package();
}
```

### Validating the `powerup` property

The `powerup` property (`SINGULAR_NAME` constant) must be an object with an
`instructions` string field. Validation uses the SDK's zod schema:

**SDK schema** (`packages/sdk/src/private/schema/powerup.ts`):

```ts
import zod from "zod";

export const powerupPropertySchema = zod.object({
  instructions: zod.string(),
  compatibility: zod.record(zod.string(), zod.unknown()).optional(),
});

export type PowerupProperty = zod.infer<typeof powerupPropertySchema>;
```

**Build command usage:**

```ts
import { powerupPropertySchema } from "@liolocs/powerups-sdk";

const result = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME]);

if (!result.success) {
  throw build_errors.malformed_powerup_property(result.error.message);
}

const instructionsPath = result.data.instructions;
const tsFileRef = cwd.append(`/${instructionsPath}`);
```

Using `safeParse` captures the full zod error details so the author sees
exactly what's wrong. This also cleanly rejects the old string format
(`"powerup": "./instructions.json"`) since a string won't match the object
schema.

The `compatibility` field is accepted but ignored for now — we don't validate
or act on its contents.

## Executing the TS File

The TS file default-exports a function that returns an `Instructions` object.
We import it using `@rcompat/fs`'s `FileRef.import()` method and call the
function.

```ts
const module = await tsFileRef.import();

if (typeof module.default !== "function") {
  throw build_errors.invalid_instructions_file(tsFileRef);
}

const instructions = module.default();
```

### Runtime considerations

`FileRef.import()` uses the runtime's native dynamic `import()`. This works
directly on Bun and Deno (native TypeScript support). On Node, it requires
`--experimental-strip-types`.

The build command uses direct `import()` only — no child process fallback.
This is acceptable because `pup build` is a developer tool run by powerup
authors who control their runtime. (The existing `ts.ts` template runner needs
a child process fallback because `pup use` must work in end-user projects that
may only have Node.)

## Validating the Instructions

Once we have the instructions object from calling the default export, we
validate it against the SDK's zod `instructionsSchema`:

```ts
import { instructionsSchema } from "@liolocs/powerups-sdk";

const parseResult = instructionsSchema.safeParse(instructions);

if (!parseResult.success) {
  throw build_errors.malformed_instructions(parseResult.error.message);
}

const validated = parseResult.data;
```

Using `safeParse` captures the full zod error details (which fields failed,
what was expected) and passes them into the error message. The `validated`
object is what we write to `dist/instructions.json`.

## Writing dist/instructions.json

After validation, we create the `dist` folder and write the instructions as
JSON.

```ts
const distRef = cwd.append("/dist");

if (await distRef.exists()) {
  await distRef.remove({ recursive: true });
}

await distRef.create();

await distRef.append("/instructions.json").writeJSON(validated);
```

**Clean rebuild:** We remove an existing `dist/` before writing, so stale files
from a previous build (e.g., a template that's no longer referenced) don't
linger. This mirrors the CLI's own `clean` script (`rm -rf ./lib`) before
building.

`writeJSON` is `@rcompat/fs`'s `FileRef.writeJSON(input: JSONValue)` — it
handles serialization internally, so we pass the validated object directly.

## Copying Template Files

The instructions reference template files by relative path (e.g.,
`template/command.ts.ts`). We copy each referenced template into `dist/`
preserving the same relative path, so the distributable is self-contained.

### Finding templates

We walk the validated instructions' `steps` array and collect template paths
from:

- `create` steps → `step.template`
- `modify` steps → `step.template`
- `read` steps → `step.template` (optional — only present in template mode)

`include` steps reference other powerups by name, not file paths, so they're
skipped.

```ts
const templatePaths = new Set<string>();

for (const step of validated.steps) {
  if (step.type === "create" || step.type === "modify") {
    templatePaths.add(step.template);
  } else if (step.type === "read" && step.template) {
    templatePaths.add(step.template);
  }
}
```

### Copying

For each template path, we copy from `<cwd>/<templatePath>` to
`<cwd>/dist/<templatePath>`, creating intermediate directories as needed:

```ts
for (const templatePath of templatePaths) {
  const srcRef = cwd.append(`/${templatePath}`);
  const destRef = distRef.append(`/${templatePath}`);

  if (!(await srcRef.exists())) {
    throw build_errors.template_not_found(templatePath);
  }

  await destRef.directory.create();
  await srcRef.copy(destRef);
}
```

This runs after `dist/` is created and `instructions.json` is written. If a
referenced template doesn't exist, we error with a clear message — this catches
authoring mistakes early.

## Error Handling

A new `buildErrors.ts` file following the exact pattern of all other error
files in `src/private/errors/`.

### Error cases

1. **`no_package_json`** — no `package.json` in cwd
2. **`not_a_powerups_package`** — `package.json` doesn't have
   `powerups-package` in its `keywords` array
3. **`malformed_powerup_property`** — zod `safeParse` fails on the `powerup`
   property (includes zod's error detail)
4. **`invalid_instructions_file`** — the TS file's default export isn't a
   function
5. **`malformed_instructions`** — zod `safeParse` fails on the instructions
   object (includes zod's error detail)
6. **`template_not_found`** — a referenced template file doesn't exist on disk

### Error factory

```ts
import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, SINGULAR_NAME, KEYWORD_PACKAGE } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const build_errors = error.coded({
  no_package_json: () => {
    const errorText =
      `No package.json found in the current directory.\n\n` +
      `Run "${CLI_CMD} build" from inside a ${SINGULAR_NAME} directory.`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: () => {
    const errorText =
      `This directory is not a ${SINGULAR_NAME} package.\n` +
      `package.json must have "${KEYWORD_PACKAGE}" in its keywords array.\n\n` +
      `Run "${CLI_CMD} build" from inside a ${SINGULAR_NAME} directory.`;
    return t`${errorBGText}${errorText}`;
  },

  malformed_powerup_property: (detail: string) => {
    const errorText =
      `The "powerup" property in package.json is malformed.\n` +
      `Expected an object with an "instructions" string field.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },

  invalid_instructions_file: (fileName: string) => {
    const errorText =
      `Invalid instructions file: ${fileName}\n` +
      `Must export a default function that returns an Instructions object.`;
    return t`${errorBGText}${errorText}`;
  },

  malformed_instructions: (detail: string) => {
    const errorText =
      `The instructions object is malformed.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },

  template_not_found: (templatePath: string) => {
    const errorText = `Template file not found: ${templatePath}`;
    return t`${errorBGText}${errorText}`;
  },
});
```

## Testing

A `build.spec.ts` file following the existing test pattern (using
`@rcompat/test`, creating temp directories, asserting outcomes).

### Test cases

1. **Happy path** — valid `package.json` with `powerup.instructions` pointing
   to a TS file that exports a function returning valid instructions with
   template references. Assert: `dist/instructions.json` exists and matches the
   expected instructions; template files are copied to `dist/`.

2. **No package.json** — run in an empty temp dir. Assert: throws
   `no_package_json`.

3. **Not a powerups package** — `package.json` without `powerups-package` in
   keywords. Assert: throws `not_a_powerups_package`.

4. **Malformed powerup property (old string format)** — `package.json` with
   `"powerup": "./instructions.json"`. Assert: throws
   `malformed_powerup_property`.

5. **Missing instructions field** — `package.json` with
   `"powerup": { "compatibility": {} }` (no `instructions`). Assert: throws
   `malformed_powerup_property`.

6. **Invalid instructions file (no default function)** — TS file that exports a
   const, not a default function. Assert: throws `invalid_instructions_file`.

7. **Malformed instructions (schema validation fails)** — TS file whose
   function returns an object missing required fields (e.g., no `steps`).
   Assert: throws `malformed_instructions`.

8. **Template not found** — instructions reference a template path that
   doesn't exist on disk. Assert: throws `template_not_found`.

9. **Clean rebuild** — run build twice; first run creates `dist/` with a stale
   extra file, second run removes it. Assert: stale file is gone after second
   build.

10. **Read step with template** — instructions include a `read` step with a
    `template` field. Assert: the read template is copied to `dist/`.

11. **Read step without template (jsonPath/raw mode)** — instructions include a
    `read` step with no `template`. Assert: no error, nothing extra copied.

### Test setup pattern

Matching existing specs like `ts.spec.ts`:

```ts
const tmpDir = root.append("/.test-build-tmp");

// setup: create tmpDir, write package.json + index.ts + templates
// run build
// assert
// teardown: await tmpDir.remove()
```

Each test creates its own temp directory with the needed files, runs the build
logic, asserts outcomes, and cleans up.