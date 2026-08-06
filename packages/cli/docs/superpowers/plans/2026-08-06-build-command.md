# Build Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pup build` command that compiles a powerup's TypeScript instructions source into `dist/instructions.json` and copies referenced template files into `dist/`.

**Architecture:** A new `build` command in the CLI that reads `package.json` from cwd, validates the `powerup` property using a new zod schema from the SDK, imports and executes the referenced TS file (default-export function returning an `Instructions` object), validates the result against the SDK's `instructionsSchema`, creates a `dist/` folder, writes `instructions.json`, and copies all referenced template files preserving relative paths. The core logic is extracted into a `buildPowerup(cwd: FileRef)` function for testability.

**Tech Stack:** TypeScript, zod (via `@liolocs/powerups-sdk`), `@rcompat/fs`, `@rcompat/runtime`, `@liolocs/program`, `@rcompat/test`, `@rcompat/error`, pema (existing CLI schemas, unchanged)

---

## File Structure

### SDK package (`packages/sdk/`)

| File | Responsibility |
|------|----------------|
| `src/private/schema/powerup.ts` | Zod schema for the `powerup` property in a powerup's `package.json` |
| `src/private/schema/powerup.spec.ts` | Tests for the powerup property schema |
| `src/private/index.ts` (modify) | Re-export `powerupPropertySchema`, `instructionsSchema`, and their types |

### CLI package (`packages/cli/`)

| File | Responsibility |
|------|----------------|
| `src/private/errors/buildErrors.ts` | Error factory for all build command error cases |
| `src/private/commands/build/index.ts` | Build command implementation + `buildPowerup` function |
| `src/private/commands/build/build.spec.ts` | Tests for the build command |
| `src/commands/build.ts` | Thin wrapper re-exporting from private |
| `src/commands/index.ts` (modify) | Register the `build` command |
| `package.json` (modify) | Add `@liolocs/powerups-sdk` to `devDependencies` |
| `tsup.config.ts` (modify) | Add `@liolocs/powerups-sdk` to `noExternal` |

---

### Task 1: SDK — Create powerup property schema (TDD)

**Files:**
- Create: `packages/sdk/src/private/schema/powerup.spec.ts`
- Create: `packages/sdk/src/private/schema/powerup.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/src/private/schema/powerup.spec.ts`:

```ts
import test from "@rcompat/test";
import { powerupPropertySchema } from "#schema/powerup";

test.case("accepts a valid powerup property with instructions", () => {
  const result = powerupPropertySchema.parse({
    instructions: "index.ts",
  });

  assert(result.instructions).equals("index.ts");
});

test.case("accepts a powerup property with compatibility", () => {
  const result = powerupPropertySchema.parse({
    instructions: "index.ts",
    compatibility: { version: "1.0.0" },
  });

  assert(result.instructions).equals("index.ts");
  assert(result.compatibility).defined();
});

test.case("rejects a powerup property missing instructions", () => {
  let threw = false;
  try {
    powerupPropertySchema.parse({ compatibility: {} });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a string powerup property (old format)", () => {
  let threw = false;
  try {
    powerupPropertySchema.parse("./instructions.json");
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a non-string instructions field", () => {
  let threw = false;
  try {
    powerupPropertySchema.parse({ instructions: 123 });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("rejects a non-object powerup property", () => {
  let threw = false;
  try {
    powerupPropertySchema.parse(null);
  } catch {
    threw = true;
  }
  assert(threw).true();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from the repo root:
```bash
cd packages/sdk && npx proby -- src/private/schema/powerup.spec.ts
```
Expected: FAIL — module `#schema/powerup` not found.

- [ ] **Step 3: Write minimal implementation**

Create `packages/sdk/src/private/schema/powerup.ts`:

```ts
import zod from "zod";

export const powerupPropertySchema = zod.object({
  instructions: zod.string(),
  compatibility: zod.record(zod.string(), zod.unknown()).optional(),
});

export type PowerupProperty = zod.infer<typeof powerupPropertySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd packages/sdk && npx proby -- src/private/schema/powerup.spec.ts
```
Expected: PASS — all 6 cases pass.

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/sdk/src/private/schema/powerup.ts packages/sdk/src/private/schema/powerup.spec.ts
git commit -m "feat: add powerup property schema to SDK"
```

---

### Task 2: SDK — Wire up exports

**Files:**
- Modify: `packages/sdk/src/private/index.ts`

- [ ] **Step 1: Update the SDK private index to export schemas**

Replace the entire contents of `packages/sdk/src/private/index.ts` with:

```ts
export { powerupPropertySchema, type PowerupProperty } from "#schema/powerup";
export { instructionsSchema, type Instructions, type Step } from "#schema/instructions";
```

The public index (`packages/sdk/src/public/index.ts`) already re-exports everything from `#index`:
```ts
export { default } from "#index";
export * from "#index";
```

So the schemas will be available from `@liolocs/powerups-sdk` once the SDK is built.

- [ ] **Step 2: Verify the SDK builds**

Run:
```bash
cd packages/sdk && npm run build
```
Expected: Builds successfully, `lib/public/index.js` and `lib/private/index.js` are created.

- [ ] **Step 3: Verify the existing SDK tests still pass**

Run:
```bash
cd packages/sdk && npx proby
```
Expected: PASS — all existing tests pass.

- [ ] **Step 4: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/sdk/src/private/index.ts
git commit -m "feat: export schemas from SDK public API"
```

---

### Task 3: CLI — Add SDK dependency and update tsup config

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/tsup.config.ts`

- [ ] **Step 1: Add the SDK as a devDependency**

In `packages/cli/package.json`, add `"@liolocs/powerups-sdk": "workspace:^"` to the `devDependencies` object, after the `"@liolocs/program"` line:

```json
  "devDependencies": {
    "@liolocs/program": "workspace:^",
    "@liolocs/powerups-sdk": "workspace:^",
    "@types/nunjucks": "^3.2.6",
    "commit-and-tag-version": "^13.1.2",
    "tsup": "^8.5.1"
  },
```

- [ ] **Step 2: Add the SDK to tsup's noExternal**

In `packages/cli/tsup.config.ts`, add `"@liolocs/powerups-sdk"` to the `noExternal` array:

```ts
  noExternal: ["@liolocs/program", "@liolocs/powerups-sdk"],
```

- [ ] **Step 3: Install dependencies**

Run from the repo root:
```bash
pnpm install
```
Expected: Installs successfully, links the workspace `@liolocs/powerups-sdk` package.

- [ ] **Step 4: Verify the CLI still builds**

Run:
```bash
cd packages/cli && npm run build
```
Expected: Builds successfully.

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/cli/package.json packages/cli/tsup.config.ts pnpm-lock.yaml
git commit -m "chore: add @liolocs/powerups-sdk as CLI devDependency"
```

---

### Task 4: CLI — Create build error factory

**Files:**
- Create: `packages/cli/src/private/errors/buildErrors.ts`

- [ ] **Step 1: Create the error factory**

Create `packages/cli/src/private/errors/buildErrors.ts`:

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

export type BuildErrorCode = keyof typeof build_errors;

export const BuildErrorCode = Object.fromEntries(
  Object.keys(build_errors).map(k => [k, k]),
) as { [K in BuildErrorCode]: K };

export default build_errors;
```

- [ ] **Step 2: Verify the CLI compiles**

Run:
```bash
cd packages/cli && npx tsgo
```
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/cli/src/private/errors/buildErrors.ts
git commit -m "feat: add build error factory"
```

---

### Task 5: CLI — Create build command (TDD)

**Files:**
- Create: `packages/cli/src/private/commands/build/build.spec.ts`
- Create: `packages/cli/src/private/commands/build/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/private/commands/build/build.spec.ts`:

```ts
import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import { buildPowerup } from "#commands/build";
import { BuildErrorCode } from "#errors/buildErrors";
import { KEYWORD_PACKAGE } from "#constants";

const root = await runtime.projectRoot();
const tmpDir = root.append("/.test-build-tmp");

async function setupPowerup(files: Record<string, string>) {
  await fs.create(tmpDir);
  for (const [path, content] of Object.entries(files)) {
    const ref = tmpDir.append(`/${path}`);
    await ref.directory.create();
    await ref.write(content);
  }
}

async function teardown() {
  if (await fs.exists(tmpDir)) {
    await tmpDir.remove({ recursive: true });
  }
}

const validInstructionsTs =
  `export default () => ({\n` +
  `  name: "test-powerup",\n` +
  `  type: "single-use",\n` +
  `  description: "A test powerup",\n` +
  `  variables: { required: [] },\n` +
  `  intent: [],\n` +
  `  steps: [\n` +
  `    { type: "create", name: "comp", template: "template/comp.ts.ts", outputPath: "src/comp.ts" },\n` +
  `  ],\n` +
  `});\n`;

const validPackageJson = JSON.stringify({
  name: "test-powerup",
  version: "1.0.0",
  description: "A test powerup",
  keywords: [KEYWORD_PACKAGE],
  powerup: { instructions: "index.ts" },
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test.group("build (success)", () => {
  test.case("builds a valid powerup with templates", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      "template/comp.ts.ts": "export const comp = 1;\n",
    });

    await buildPowerup(tmpDir);

    // instructions.json exists
    const instructionsRef = tmpDir.append("/dist/instructions.json");
    assert(await fs.exists(instructionsRef)).true();

    // instructions.json content
    const instructions = await instructionsRef.json() as Record<string, unknown>;
    assert(instructions.name).equals("test-powerup");
    assert(instructions.type).equals("single-use");
    const steps = instructions.steps as unknown[];
    assert(steps.length).equals(1);

    // template copied
    const templateRef = tmpDir.append("/dist/template/comp.ts.ts");
    assert(await fs.exists(templateRef)).true();

    await teardown();
  });

  test.case("copies read step templates but not raw/jsonPath reads", async assert => {
    await teardown();
    const instructionsTs =
      `export default () => ({\n` +
      `  name: "test-powerup",\n` +
      `  type: "single-use",\n` +
      `  description: "A test powerup",\n` +
      `  variables: { required: [] },\n` +
      `  intent: [],\n` +
      `  steps: [\n` +
      `    { type: "read", name: "r1", path: "package.json", as: "name", jsonPath: "name" },\n` +
      `    { type: "read", name: "r2", path: "README.md", as: "text", template: "template/extract.ts.ts" },\n` +
      `  ],\n` +
      `});\n`;

    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": instructionsTs,
      "template/extract.ts.ts": "export default () => 'extracted';\n",
    });

    await buildPowerup(tmpDir);

    // Template from read step should be copied
    const templateRef = tmpDir.append("/dist/template/extract.ts.ts");
    assert(await fs.exists(templateRef)).true();

    // No package.json or README.md copied (they are read targets, not templates)
    assert(await fs.exists(tmpDir.append("/dist/package.json"))).false();

    await teardown();
  });

  test.case("clean rebuild removes stale files", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      "template/comp.ts.ts": "export const comp = 1;\n",
    });

    // First build
    await buildPowerup(tmpDir);

    // Add a stale file in dist
    await tmpDir.append("/dist/stale.txt").write("stale");

    // Second build
    await buildPowerup(tmpDir);

    // Stale file should be gone
    assert(await fs.exists(tmpDir.append("/dist/stale.txt"))).false();

    // instructions.json should still be there
    assert(await fs.exists(tmpDir.append("/dist/instructions.json"))).true();

    await teardown();
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

test.group("build (errors)", () => {
  test.case("errors when no package.json exists", async assert => {
    await teardown();
    await fs.create(tmpDir);

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.no_package_json);

    await teardown();
  });

  test.case("errors when keywords is missing powerups-package", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": JSON.stringify({
        name: "not-a-powerup",
        version: "1.0.0",
        keywords: ["something-else"],
        powerup: { instructions: "index.ts" },
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.not_a_powerups_package);

    await teardown();
  });

  test.case("errors on old string powerup format", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": JSON.stringify({
        name: "old-format",
        version: "1.0.0",
        keywords: [KEYWORD_PACKAGE],
        powerup: "./instructions.json",
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_powerup_property);

    await teardown();
  });

  test.case("errors when instructions field is missing", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": JSON.stringify({
        name: "no-instructions",
        version: "1.0.0",
        keywords: [KEYWORD_PACKAGE],
        powerup: { compatibility: {} },
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_powerup_property);

    await teardown();
  });

  test.case("errors when TS file has no default function", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": "export const notDefault = () => ({});\n",
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.invalid_instructions_file);

    await teardown();
  });

  test.case("errors when instructions object is malformed", async assert => {
    await teardown();
    const badInstructionsTs =
      `export default () => ({\n` +
      `  name: "bad-powerup",\n` +
      `  type: "single-use",\n` +
      `  description: "Missing steps",\n` +
      `  variables: { required: [] },\n` +
      `  intent: [],\n` +
      `});\n`;

    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": badInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_instructions);

    await teardown();
  });

  test.case("errors when a referenced template does not exist", async assert => {
    await teardown();
    await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      // template/comp.ts.ts is intentionally missing
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.template_not_found);

    await teardown();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd packages/cli && npx proby -- src/private/commands/build/build.spec.ts
```
Expected: FAIL — module `#commands/build` not found.

- [ ] **Step 3: Write the build command implementation**

Create `packages/cli/src/private/commands/build/index.ts`:

```ts
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import { powerupPropertySchema, instructionsSchema } from "@liolocs/powerups-sdk";
import build_errors from "#errors/buildErrors";
import {
  SINGULAR_NAME,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
} from "#constants";

export async function buildPowerup(cwd: FileRef): Promise<void> {
  // 1. Read package.json
  const packageJsonRef = cwd.append(`/${PACKAGE_FILE}`);

  if (!(await packageJsonRef.exists())) {
    throw build_errors.no_package_json();
  }

  const pkgJson = await packageJsonRef.json() as Record<string, unknown>;

  // 2. Guard: confirm this is a powerups package
  const keywords = pkgJson.keywords;
  if (!Array.isArray(keywords) || !keywords.includes(KEYWORD_PACKAGE)) {
    throw build_errors.not_a_powerups_package();
  }

  // 3. Validate the powerup property
  const powerupResult = powerupPropertySchema.safeParse(
    pkgJson[SINGULAR_NAME],
  );

  if (!powerupResult.success) {
    throw build_errors.malformed_powerup_property(powerupResult.error.message);
  }

  const instructionsPath = powerupResult.data.instructions;
  const tsFileRef = cwd.append(`/${instructionsPath}`);

  // 4. Execute the TS file
  const module = await tsFileRef.import();

  if (typeof module.default !== "function") {
    throw build_errors.invalid_instructions_file(tsFileRef.name);
  }

  const instructions = module.default();

  // 5. Validate the instructions
  const instructionsResult = instructionsSchema.safeParse(instructions);

  if (!instructionsResult.success) {
    throw build_errors.malformed_instructions(instructionsResult.error.message);
  }

  const validated = instructionsResult.data;

  // 6. Create dist folder (clean rebuild)
  const distRef = cwd.append("/dist");

  if (await distRef.exists()) {
    await distRef.remove({ recursive: true });
  }

  await distRef.create();

  // 7. Write instructions.json
  await distRef.append("/instructions.json").writeJSON(validated);

  // 8. Copy template files
  const templatePaths = new Set<string>();

  for (const step of validated.steps) {
    if (step.type === "create" || step.type === "modify") {
      templatePaths.add(step.template);
    } else if (step.type === "read" && step.template) {
      templatePaths.add(step.template);
    }
  }

  for (const templatePath of templatePaths) {
    const srcRef = cwd.append(`/${templatePath}`);
    const destRef = distRef.append(`/${templatePath}`);

    if (!(await srcRef.exists())) {
      throw build_errors.template_not_found(templatePath);
    }

    await destRef.directory.create();
    await srcRef.copy(destRef);
  }

  // 9. Print success
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

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd packages/cli && npx proby -- src/private/commands/build/build.spec.ts
```
Expected: PASS — all 10 cases pass (3 success + 7 error).

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/cli/src/private/commands/build/index.ts packages/cli/src/private/commands/build/build.spec.ts
git commit -m "feat: add build command implementation"
```

---

### Task 6: CLI — Register build command

**Files:**
- Create: `packages/cli/src/commands/build.ts`
- Modify: `packages/cli/src/commands/index.ts`

- [ ] **Step 1: Create the thin wrapper**

Create `packages/cli/src/commands/build.ts`:

```ts
import build from "../private/commands/build/index.js";

export default build;
```

- [ ] **Step 2: Register in the commands index**

In `packages/cli/src/commands/index.ts`, add the import and array entry. The file should look like this:

```ts
import { type Command } from "@liolocs/program";
import add from "./add.js";
import build from "./build.js";
import create from "./create.js";
import doctor from "./doctor.js";
import find from "./find.js";
import info from "./info.js";
import install from "./install.js";
import list from "./list.js";
import metrics from "./metrics.js";
import pack from "./pack.js";
import project from "./project.js";
import update from "./update.js";
import use from "./use.js";
import validate from "./validate.js";

const commands: Command<any>[] = [
  add,
  build,
  create,
  doctor,
  find,
  info,
  install,
  list,
  metrics,
  pack,
  project,
  update,
  use,
  validate,
];
export default commands;
```

- [ ] **Step 3: Verify the CLI compiles**

Run:
```bash
cd packages/cli && npx tsgo
```
Expected: Compiles without errors.

- [ ] **Step 4: Verify the full CLI builds**

Run:
```bash
cd packages/cli && npm run build
```
Expected: Builds successfully (tsgo + tsup + template copy).

- [ ] **Step 5: Verify all tests pass**

Run:
```bash
cd packages/cli && npx proby
```
Expected: PASS — all existing tests plus the new build tests pass.

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add packages/cli/src/commands/build.ts packages/cli/src/commands/index.ts
git commit -m "feat: register build command in CLI"
```