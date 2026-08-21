# Implementation Plan: New `create` Command

## Spec Reference
`docs/superpowers/specs/2026-08-20-create-command-new-design.md`

## Overview
Implement the new `create` command (`create-new.ts`) that dogfoods the internal `create-powerup` powerup via `runPowerup`, with optional capture post-processing and config registration. New utilities go in `utils/create/` (replacing old code). Reuses `getPowerup`, `checkCompiledInstructionsForErrors`, `runPowerup` from `utils/use/`.

---

## Phase 1: Update `createErrors.ts`

### Step 1.1: Update error file
**File:** `packages/cli/src/private/errors/createErrors.ts`

Remove errors: `missing_type`, `invalid_package_deps_json`, `not_a_git_repo`, `package_not_initialized`

Keep errors: `missing_name`, `already_exists`, `main_folder_not_found`

Add errors:
- `invalid_capture` — bad `--capture` value with usage instructions
- `missing_description` — `--description` not passed
- `global_root_not_found` — global root doesn't exist

```ts
invalid_capture: (value: string) => {
  const errorText =
    `Invalid --capture value "${value}". Must be "all" or "workingDir".\n\n` +
    `Usage: ${CLI_CMD} create <name> --capture=<all|workingDir>`;
  return t`${errorBGText}${errorText}`;
},
missing_description: () => {
  const errorText =
    `${CAPITALIZED_SINGLULAR_CLI_NAME} description is required.\n\n` +
    `Usage: ${CLI_CMD} create <name> --description="..."`;
  return t`${errorBGText}${errorText}`;
},
global_root_not_found: () => {
  const errorText =
    `Global ${CLI_FOLDER_NAME} folder not found. Run "${CLI_CMD} project init" first, or use --local to create locally.`;
  return t`${errorBGText}${errorText}`;
},
```

### Step 1.2: Write spec
**File:** `packages/cli/src/private/errors/createErrors.spec.ts`

Tests:
- `invalid_capture` error contains the invalid value and usage instructions
- `missing_description` error contains usage instructions
- `global_root_not_found` error mentions `--local` alternative
- `missing_name` still works (unchanged)
- `already_exists` still works (unchanged)
- `main_folder_not_found` still works (unchanged)

### Step 1.3: Run specs
```bash
npx proby src/private/errors/createErrors.spec.ts
```

**Expected:** 6 tests pass, 0 fail.

---

## Phase 2: Pre-Create Validation

### Step 2.1: `check-name-was-passed.ts`
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-name-was-passed.ts`

Same pattern as `use/check-for-pre-use-errors/check-name-for-powerup-was-passed.ts`, but uses `create_errors.missing_name()`.

```ts
import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

export default function checkNameWasPassed(powerupName?: string): void {
  if (is.undefined(powerupName) || is.falsy(powerupName)) {
    throw create_errors.missing_name();
  }
}
```

### Step 2.2: `check-capture-flag-valid.ts`
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-capture-flag-valid.ts`

```ts
import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

const VALID_CAPTURE_VALUES = ["all", "workingDir"];

export default function checkCaptureFlagValid(captureValue?: string): void {
  if (is.defined(captureValue) && !VALID_CAPTURE_VALUES.includes(captureValue)) {
    throw create_errors.invalid_capture(captureValue);
  }
}
```

### Step 2.3: `check-description-was-passed.ts`
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-description-was-passed.ts`

```ts
import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

export default function checkDescriptionWasPassed(description?: string): void {
  if (is.undefined(description) || is.falsy(description)) {
    throw create_errors.missing_description();
  }
}
```

### Step 2.4: `check-powerup-does-not-exist.ts`
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-powerup-does-not-exist.ts`

```ts
import create_errors from "#errors/createErrors";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function checkPowerupDoesNotExist({
  powerupDirectory,
  name,
}: {
  powerupDirectory: FileRef;
  name: string;
}): Promise<void> {
  const targetPath = powerupDirectory.append(`/${name}`);

  if (await fs.exists(targetPath)) {
    throw create_errors.already_exists(name);
  }
}
```

### Step 2.5: `check-folder-structure-exists.ts`
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-folder-structure-exists.ts`

```ts
import create_errors from "#errors/createErrors";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function checkFolderStructureExists({
  isLocal,
  projectRoot,
  globalRoot,
}: {
  isLocal: boolean;
  projectRoot: FileRef;
  globalRoot: FileRef;
}): Promise<void> {
  if (isLocal) {
    const powerupsFolder = projectRoot.append("/.powerups");

    if (!(await fs.exists(powerupsFolder))) {
      throw create_errors.main_folder_not_found();
    }
  } else {
    if (!(await fs.exists(globalRoot))) {
      throw create_errors.global_root_not_found();
    }
  }
}
```

### Step 2.6: `index.ts` (orchestrator)
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/index.ts`

```ts
import type { FileRef } from "@rcompat/fs";
import checkNameWasPassed from "#utils/create/check-for-pre-create-errors/check-name-was-passed";
import checkCaptureFlagValid from "#utils/create/check-for-pre-create-errors/check-capture-flag-valid";
import checkDescriptionWasPassed from "#utils/create/check-for-pre-create-errors/check-description-was-passed";
import checkPowerupDoesNotExist from "#utils/create/check-for-pre-create-errors/check-powerup-does-not-exist";
import checkFolderStructureExists from "#utils/create/check-for-pre-create-errors/check-folder-structure-exists";

export default async function checkForPreCreateErrors({
  powerupName,
  captureValue,
  description,
  isLocal,
  powerupDirectory,
  projectRoot,
  globalRoot,
}: {
  powerupName?: string;
  captureValue?: string;
  description?: string;
  isLocal: boolean;
  powerupDirectory: FileRef;
  projectRoot: FileRef;
  globalRoot: FileRef;
}): Promise<void> {
  checkNameWasPassed(powerupName);

  checkCaptureFlagValid(captureValue);

  checkDescriptionWasPassed(description);

  await checkPowerupDoesNotExist({ powerupDirectory, name: powerupName! });

  await checkFolderStructureExists({ isLocal, projectRoot, globalRoot });
}
```

### Step 2.7: Write specs
**File:** `packages/cli/src/private/utils/create/check-for-pre-create-errors/index.spec.ts`

Tests (follow `#test-utils/test/index` pattern — use `setupTestDir`/`cleanup` for file/git setup, `throwsAsync` for async throws, `@ts-expect-error` for sync throws):
- "should throw missing_name when no powerup name is passed"
- "should throw invalid_capture when an invalid capture value is passed"
- "should not throw when capture value is all"
- "should not throw when capture value is workingDir"
- "should not throw when capture flag is not passed (undefined)"
- "should throw missing_description when description is not passed"
- "should throw already_exists when the powerup directory already exists"
- "should throw main_folder_not_found when local and .powerups/ folder does not exist"
- "should throw global_root_not_found when global and global root does not exist"
- "should pass when all checks succeed"

### Step 2.8: Run specs
```bash
npx proby src/private/utils/create/check-for-pre-create-errors/index.spec.ts
```

**Expected:** ~10 tests pass, 0 fail.

---

## Phase 3: Build Variables

### Step 3.1: `build-variables.ts`
**File:** `packages/cli/src/private/utils/create/build-variables.ts`

Maps CLI flags → create-powerup variable names. Manual mapping because of name mismatches (`--variables` → `requiredVariables`, `--type` → `powerupType`, `outputPath` from `--local`).

```ts
import type { ResolvedVariable } from "#utils/variables";
import is from "@rcompat/is";

export default function buildVariables({
  name,
  description,
  intent,
  requiredVariables,
  optionalVariables,
  powerupType,
  outputPath,
}: {
  name: string;
  description?: string;
  intent?: string;
  requiredVariables?: string;
  optionalVariables?: string;
  powerupType?: string;
  outputPath: string;
}): ResolvedVariable {
  return {
    name,
    description: description ?? "",
    intent: intent ?? "",
    requiredVariables: requiredVariables ?? "",
    optionalVariables: optionalVariables ?? "",
    powerupType: is.defined(powerupType) && powerupType.length > 0 ? powerupType : "single-use",
    outputPath,
  };
}
```

### Step 3.2: Write spec
**File:** `packages/cli/src/private/utils/create/build-variables.spec.ts`

Tests:
- Returns correct mapping for all fields
- Defaults `powerupType` to `"single-use"` when not passed
- Defaults `powerupType` to `"single-use"` when empty string
- Defaults optional fields to empty strings
- Uses provided `outputPath` as-is

### Step 3.3: Run specs
```bash
npx proby src/private/utils/create/build-variables.spec.ts
```

**Expected:** 5 tests pass, 0 fail.

---

## Phase 4: Capture Utilities (shared)

These are recreated fresh (not imported from old `utils/create/`).

### Step 4.1: `wrap-as-template.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/wrap-as-template.ts`

Same logic as old `utils/create/steps/wrap-as-template.ts`:

```ts
export default function wrapAsTemplate(content: string): string {
  return `export default function(_variables: Record<string, string>): string {\n  return ${JSON.stringify(content)};\n}\n`;
}
```

### Step 4.2: `wrap-as-template.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/wrap-as-template.spec.ts`

Pure function — no `setupTestDir`/`cleanup` needed.

Tests (follow `#test-utils/test/index` pattern):
- "should wrap simple content as a default-exported function returning the content as a string"
- "should escape special characters (quotes, backslashes, newlines) safely via JSON.stringify"
- "should wrap empty content as a function returning an empty string"

### Step 4.3: `generate-step-name.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/generate-step-name.ts`

Same logic as old `utils/create/steps/generate-step-name.ts`:

```ts
export default function generateStepName({
  prefix,
  filePath,
  existingNames,
}: {
  prefix: "create" | "modify" | "delete";
  filePath: string;
  existingNames: Set<string>;
}): string {
  const lastDotIndex = filePath.lastIndexOf(".");
  const lastSlashIndex = filePath.lastIndexOf("/");
  const pathNoExt = lastDotIndex > lastSlashIndex
    ? filePath.substring(0, lastDotIndex)
    : filePath;
  const baseName = `${prefix}-${pathNoExt.replace(/\//g, "-")}`;

  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  let counter = 2;

  while (existingNames.has(`${baseName}-${counter}`)) {
    counter++;
  }

  const finalName = `${baseName}-${counter}`;
  existingNames.add(finalName);

  return finalName;
}
```

### Step 4.4: `generate-step-name.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/generate-step-name.spec.ts`

Pure function — no `setupTestDir`/`cleanup` needed.

Tests (follow `#test-utils/test/index` pattern):
- "should generate a step name with create prefix for a file in a subdirectory" — `generateStepName({ prefix: "create", filePath: "src/component.ts", existingNames: new Set() })` returns `"create-src-component"`
- "should generate a step name with modify prefix for a config file" — `generateStepName({ prefix: "modify", filePath: "config.json", existingNames: new Set() })` returns `"modify-config"`
- "should generate a step name with delete prefix for a readme file" — `generateStepName({ prefix: "delete", filePath: "README.md", existingNames: new Set() })` returns `"delete-README"`
- "should append a numeric suffix when the name already exists" — first call returns `"create-src-component"`, second call returns `"create-src-component-2"`, third returns `"create-src-component-3"`
- "should handle files without an extension" — `generateStepName({ prefix: "create", filePath: "Dockerfile", existingNames: new Set() })` returns `"create-Dockerfile"`

### Step 4.5: `git-status.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/git-status.ts`

Recreated from old `utils/create/git/git-status.ts`. Key differences:
- Does NOT throw `not_a_git_repo` from createErrors (that error is removed). Instead throws a generic Error (capture logic handles git repo requirement).
- Excludes `.powerups/` paths and lock files (same as old).
- Same `GitChange` type and `getGitStatus` function.

```ts
import io from "@rcompat/io";
import { type FileRef } from "@rcompat/fs";
import path from "node:path";

export type GitChangeStatus = "new" | "modified" | "deleted" | "renamed" | "unknown";

export type GitChange = {
  path: string;
  status: GitChangeStatus;
  rawStatus: string;
};

const EXCLUDED_PATHS = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "bun.lock", "bun.lockb",
]);

// ... (same classifyStatus, shouldExclude, unquotePath, extractPath, getGitStatus as old)
```

### Step 4.6: `git-status.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/git-status.spec.ts`

Requires git repo setup — use `setupTestDir`/`cleanup` pattern. Initialize a git repo in the test dir (`git init`, `git add`, `git commit`) for each test.

Tests (follow `#test-utils/test/index` pattern):
- "should classify an untracked file as new"
- "should classify a modified tracked file as modified"
- "should classify a deleted tracked file as deleted"
- "should classify a renamed file as renamed"
- "should exclude files inside the .powerups/ directory"
- "should exclude lock files (package-lock.json, pnpm-lock.yaml, etc.)"
- "should return an empty array when there are no git changes"
- "should throw an error when the working directory is not a git repository"
- "should scope git status to the specified working directory subpath"

### Step 4.7: `diff-to-modifications.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/diff-to-modifications.ts`

Recreated from old `utils/create/git/diff-to-modifications.ts`. Same logic, same types (`DiffHunk`, `DiffLine`, etc.), same `generateModifications` function. Imports `Modification` type from `#schemas/modification`.

### Step 4.8: `diff-to-modifications.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/diff-to-modifications.spec.ts`

Pure function — no `setupTestDir`/`cleanup` needed. Pass diff hunks and pre/post images directly.

Tests (follow `#test-utils/test/index` pattern):
- "should generate an insertion modification when lines are added at the top"
- "should generate an insertion modification when lines are added at the bottom"
- "should generate a replace modification when lines are changed in place"
- "should generate a delete modification when lines are removed"
- "should handle multiple hunks in a single diff"
- "should expand context to disambiguate anchors when multiple matches exist"
- "should return a warning for binary file diffs"
- "should return empty modifications for an empty diff"

### Step 4.9: Run all Phase 4 specs
```bash
npx proby src/private/utils/create/capture-files/wrap-as-template.spec.ts
npx proby src/private/utils/create/capture-files/generate-step-name.spec.ts
npx proby src/private/utils/create/capture-files/git-status.spec.ts
npx proby src/private/utils/create/capture-files/diff-to-modifications.spec.ts
```

**Expected:** All pass, 0 fail.

---

## Phase 5: Capture Implementations

### Step 5.1: `capture-all-files.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/capture-all-files.ts`

Uses `git ls-files --cached --others --exclude-standard` to list all files (respects `.gitignore`). Then applies additional exclusions: `node_modules/`, `dist/`, lock files, `.env` files, and the new powerup's own directory.

```ts
import io from "@rcompat/io";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
import generateStepName from "#utils/create/capture-files/generate-step-name";

const EXCLUDED_BASENAMES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "bun.lock", "bun.lockb",
]);

const EXCLUDED_DIR_PREFIXES = ["node_modules/", "dist/"];

export default async function captureAllFiles({
  projectRoot,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  // git ls-files respects .gitignore
  const output = await io.run(
    "git ls-files --cached --others --exclude-standard",
    { cwd: projectRoot.path },
  );

  const allFiles = output.split("\n").filter(f => f.length > 0);

  // Apply additional exclusions
  const filteredFiles = allFiles.filter(filePath => {
    // Exclude the new powerup's own directory
    const newPowerupRelativePath = projectRoot.path === newPowerupDirectory.directory.path
      ? newPowerupDirectory.path.replace(projectRoot.path + "/", "")
      : newPowerupDirectory.path;
    if (filePath.startsWith(newPowerupRelativePath + "/")) return false;

    // Exclude node_modules/ and dist/ anywhere in path
    for (const prefix of EXCLUDED_DIR_PREFIXES) {
      if (filePath.includes("/" + prefix) || filePath.startsWith(prefix)) return false;
    }

    // Exclude lock files and .env files
    const basename = filePath.split("/").pop()!;
    if (EXCLUDED_BASENAMES.has(basename)) return false;
    if (basename.startsWith(".env")) return false;

    return true;
  });

  const steps: Step[] = [];
  const existingNames = new Set<string>();
  const warnings: string[] = [];

  for (const filePath of filteredFiles) {
    const sourcePath = projectRoot.append(`/${filePath}`);
    const content = await sourcePath.text();

    const templateContent = wrapAsTemplate(content);
    const templatePath = `templates/${filePath}.ts`;

    if (!isDryRun) {
      const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
      await fs.create(templateFileRef.directory);
      await templateFileRef.write(templateContent);
    }

    const stepName = generateStepName({
      prefix: "create",
      filePath,
      existingNames,
    });

    steps.push({
      type: "create",
      name: stepName,
      template: templatePath,
      outputPath: filePath,
    });
  }

  return { steps, fileCount: filteredFiles.length, warnings };
}
```

### Step 5.2: `capture-all-files.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/capture-all-files.spec.ts`

Requires git repo setup — use `setupTestDir`/`cleanup` pattern. Initialize a git repo, create files, `git add` + `git commit` them.

Tests (follow `#test-utils/test/index` pattern):
- "should capture all tracked files as create steps with correct output paths"
- "should respect .gitignore — gitignored files are not captured"
- "should exclude files inside node_modules/ directories"
- "should exclude lock files from capture"
- "should exclude .env files from capture"
- "should exclude the newly created powerup's own directory to avoid self-referencing"
- "should include files inside .powerups/ (local powerups are captured)"
- "should not write any template files in dry-run mode"
- "should generate template files whose content matches the original file content"

### Step 5.3: `capture-working-dir.ts` + helpers
**File:** `packages/cli/src/private/utils/create/capture-files/capture-working-dir.ts`

Orchestrator only — delegates to focused helper functions. No inline comments needed because function names are self-documenting.

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import getGitStatus, { type GitChange } from "#utils/create/capture-files/git-status";
import createStepsFromNewFiles from "#utils/create/capture-files/create-steps-from-new-files";
import createStepsFromModifiedFiles from "#utils/create/capture-files/create-steps-from-modified-files";
import createStepsFromDeletedFiles from "#utils/create/capture-files/create-steps-from-deleted-files";

export default async function captureWorkingDir({
  projectRoot,
  workingDir,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  workingDir: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  const changes = await getGitStatus({ workingDir, projectRoot });

  if (changes.length === 0) {
    return { steps: [], fileCount: 0, warnings: [`No git changes detected in ${workingDir.path}`] };
  }

  const existingNames = new Set<string>();
  const warnings: string[] = [];

  const newFiles = changes.filter(c => c.status === "new").sort((a, b) => a.path.localeCompare(b.path));
  const modifiedFiles = changes.filter(c => c.status === "modified").sort((a, b) => a.path.localeCompare(b.path));
  const deletedFiles = changes.filter(c => c.status === "deleted").sort((a, b) => a.path.localeCompare(b.path));
  const renamedFiles = changes.filter(c => c.status === "renamed" || c.status === "unknown");

  const createSteps = await createStepsFromNewFiles({
    newFiles,
    projectRoot,
    newPowerupDirectory,
    existingNames,
    isDryRun,
  });

  const modifySteps = await createStepsFromModifiedFiles({
    modifiedFiles,
    projectRoot,
    newPowerupDirectory,
    existingNames,
    warnings,
    isDryRun,
  });

  const deleteSteps = createStepsFromDeletedFiles({ deletedFiles, existingNames });

  for (const change of renamedFiles) {
    warnings.push(`Renamed or unknown change: ${change.path} (${change.rawStatus}) — requires manual review, not included`);
  }

  const steps = [...createSteps, ...modifySteps, ...deleteSteps];

  return { steps, fileCount: changes.length, warnings };
}
```

### Step 5.3a: `create-steps-from-new-files.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.ts`

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
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
    const sourcePath = projectRoot.append(`/${change.path}`);
    const content = await sourcePath.text();
    const templateContent = wrapAsTemplate(content);
    const templatePath = `templates/${change.path}.ts`;

    if (!isDryRun) {
      const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
      await fs.create(templateFileRef.directory);
      await templateFileRef.write(templateContent);
    }

    const stepName = generateStepName({ prefix: "create", filePath: change.path, existingNames });

    steps.push({ type: "create", name: stepName, template: templatePath, outputPath: change.path });
  }

  return steps;
}
```

### Step 5.3b: `create-steps-from-modified-files.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.ts`

Contains the loop over modified files and the `createModifyStep` helper (adapted from old `createStepFromModifiedFile`). Generates diff-based modifications for each file.

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import { generateModifications, type DiffHunk } from "#utils/create/capture-files/diff-to-modifications";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default async function createStepsFromModifiedFiles({
  modifiedFiles,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  warnings,
  isDryRun,
}: {
  modifiedFiles: GitChange[];
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  warnings: string[];
  isDryRun: boolean;
}): Promise<Step[]> {
  const steps: Step[] = [];

  for (const change of modifiedFiles) {
    const step = await createModifyStep({
      change,
      projectRoot,
      newPowerupDirectory,
      existingNames,
      warnings,
      isDryRun,
    });

    if (step !== null) {
      steps.push(step);
    }
  }

  return steps;
}

async function createModifyStep({
  change,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  warnings,
  isDryRun,
}: {
  change: GitChange;
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  warnings: string[];
  isDryRun: boolean;
}): Promise<Step | null> {
  const diffOutput = await io.run(
    `git diff HEAD -- "${change.path}"`,
    { cwd: projectRoot.path },
  );

  if (diffOutput.includes("Binary files differ")) {
    warnings.push(`${change.path}: binary file — cannot generate modifications`);

    return null;
  }

  if (diffOutput.trim().length === 0) {
    warnings.push(`${change.path}: empty diff — no changes detected`);

    return null;
  }

  let preImage: string;

  try {
    preImage = await io.run(`git show HEAD:"${change.path}"`, { cwd: projectRoot.path });
  } catch {
    warnings.push(`${change.path}: could not read pre-image from HEAD`);

    return null;
  }

  const postImagePath = projectRoot.append(`/${change.path}`);

  if (!(await fs.exists(postImagePath))) {
    warnings.push(`${change.path}: post-image file not found`);

    return null;
  }

  const postImage = await postImagePath.text();
  const hunks = parseDiffHunks(diffOutput);
  const result = generateModifications({ preImage, postImage, hunks });

  for (const warning of result.warnings) {
    warnings.push(`${change.path}: ${warning}`);
  }

  const jsonString = JSON.stringify(result.modifications, null, 2);
  const templateContent = wrapAsTemplate(jsonString);
  const templatePath = `templates/${change.path}.modify.ts.ts`;

  if (!isDryRun) {
    const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
    await fs.create(templateFileRef.directory);
    await templateFileRef.write(templateContent);
  }

  const stepName = generateStepName({ prefix: "modify", filePath: change.path, existingNames });

  return { type: "modify", name: stepName, template: templatePath, outputPath: change.path };
}

function parseDiffHunks(diffOutput: string): DiffHunk[] { ... }
```

### Step 5.3c: `create-steps-from-deleted-files.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/create-steps-from-deleted-files.ts`

```ts
import type { Step } from "@liolocs/powerups-sdk";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default function createStepsFromDeletedFiles({
  deletedFiles,
  existingNames,
}: {
  deletedFiles: GitChange[];
  existingNames: Set<string>;
}): Step[] {
  return deletedFiles.map(change => ({
    type: "delete",
    name: generateStepName({ prefix: "delete", filePath: change.path, existingNames }),
    outputPath: change.path,
  }));
}
```

### Step 5.4: `capture-working-dir.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/capture-working-dir.spec.ts`

Requires git repo setup — use `setupTestDir`/`cleanup` pattern. Initialize a git repo, make changes (new files, modified files, deleted files), leave them unstaged or staged.

Tests for `capture-working-dir.ts` (follow `#test-utils/test/index` pattern):
- "should generate create, modify, and delete steps for a mix of git changes"
- "should return empty steps with a warning when there are no git changes"
- "should add a warning for renamed or unknown status changes without generating a step"
- "should not write any template files in dry-run mode"

Tests for `create-steps-from-new-files.ts`:
- "should generate a create step with a template for each new file"
- "should write template files to the powerup directory when not in dry-run mode"
- "should not write template files in dry-run mode"

Tests for `create-steps-from-modified-files.ts`:
- "should generate a modify step with diff-based modifications for a modified file"
- "should return null and add a warning for binary file diffs"
- "should return null and add a warning for empty diffs"
- "should not write template files in dry-run mode"

Tests for `create-steps-from-deleted-files.ts`:
- "should generate a delete step for each deleted file without a template"
- "should generate unique step names when multiple files share similar paths"

### Step 5.5: `add-steps-to-index.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/add-steps-to-index.ts`

Reads the newly created `index.ts`, replaces `steps: []` with `steps: <JSON>`.

```ts
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";

export default async function addStepsToIndex({
  indexFilePath,
  steps,
}: {
  indexFilePath: FileRef;
  steps: Step[];
}): Promise<void> {
  const content = await indexFilePath.text();
  const stepsJson = JSON.stringify(steps, null, 2);

  const updatedContent = content.replace("steps: []", `steps: ${stepsJson}`);

  await indexFilePath.write(updatedContent);
}
```

### Step 5.6: `add-steps-to-index.spec.ts`
**File:** `packages/cli/src/private/utils/create/capture-files/add-steps-to-index.spec.ts`

Requires file setup — use `setupTestDir`/`cleanup` pattern. Write a minimal `index.ts` file with `steps: []` to the test dir.

Tests (follow `#test-utils/test/index` pattern):
- "should replace steps: [] in the index file with the provided steps as JSON"
- "should preserve the rest of the file content outside the steps array"
- "should leave the file unchanged when the steps array is empty"
- "should format multiple steps with proper JSON indentation"

### Step 5.7: `capture-files/index.ts` (dispatcher)
**File:** `packages/cli/src/private/utils/create/capture-files/index.ts`

```ts
import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import captureAllFiles from "#utils/create/capture-files/capture-all-files";
import captureWorkingDir from "#utils/create/capture-files/capture-working-dir";
import addStepsToIndex from "#utils/create/capture-files/add-steps-to-index";

export type CaptureResult = {
  steps: Step[];
  fileCount: number;
  warnings: string[];
};

export default async function captureFiles({
  captureMode,
  projectRoot,
  workingDir,
  newPowerupDirectory,
  indexFilePath,
  isDryRun,
}: {
  captureMode: "all" | "workingDir";
  projectRoot: FileRef;
  workingDir: FileRef;
  newPowerupDirectory: FileRef;
  indexFilePath: FileRef;
  isDryRun: boolean;
}): Promise<CaptureResult> {
  let result: CaptureResult;

  if (captureMode === "all") {
    result = await captureAllFiles({ projectRoot, newPowerupDirectory, isDryRun });
  } else {
    result = await captureWorkingDir({ projectRoot, workingDir, newPowerupDirectory, isDryRun });
  }

  if (!isDryRun && result.steps.length > 0) {
    await addStepsToIndex({ indexFilePath, steps: result.steps });
  }

  return result;
}
```

### Step 5.8: Run all Phase 5 specs
```bash
npx proby src/private/utils/create/capture-files/capture-all-files.spec.ts
npx proby src/private/utils/create/capture-files/capture-working-dir.spec.ts
npx proby src/private/utils/create/capture-files/add-steps-to-index.spec.ts
```

**Expected:** All pass, 0 fail.

---

## Phase 6: Registration & Summary

### Step 6.1: `register-powerup.ts`
**File:** `packages/cli/src/private/utils/create/register-powerup.ts`

```ts
import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

export default async function registerPowerup({
  name,
  isLocal,
  projectRoot,
}: {
  name: string;
  isLocal: boolean;
  projectRoot: FileRef;
}): Promise<void> {
  const entry = `internal:${name}`;

  if (isLocal) {
    await addPackageToConfig(projectRoot, entry);
  } else {
    await addPackageToGlobalConfig(entry);
  }
}
```

### Step 6.2: `register-powerup.spec.ts`
**File:** `packages/cli/src/private/utils/create/register-powerup.spec.ts`

Requires file setup — use `setupTestDir`/`cleanup` pattern. Create a `.powerups/config.json` with an existing packages array.

Tests (follow `#test-utils/test/index` pattern):
- "should add internal:<name> to the local config.json when registering locally"
- "should add internal:<name> to the global config.json when registering globally (uses homeDir param for testability)"
- "should not duplicate the entry if the powerup is already registered"
- "should do nothing if the local config.json does not exist"

### Step 6.3: `print-create-summary.ts`
**File:** `packages/cli/src/private/utils/create/print-create-summary.ts`

```ts
import cli from "@rcompat/cli";
import type { CaptureResult } from "#utils/create/capture-files/index";

export default function printCreateSummary({
  name,
  isDryRun,
  captureResult,
}: {
  name: string;
  isDryRun: boolean;
  captureResult?: CaptureResult;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would create powerup: ${name}\n`);
  } else {
    cli.print(`${green("✓")} Created powerup: ${name}\n`);
  }

  if (captureResult) {
    if (captureResult.steps.length > 0) {
      cli.print(`  ${dim("captured:")} ${captureResult.fileCount} files, ${captureResult.steps.length} steps\n`);
    }
    if (captureResult.warnings.length > 0) {
      cli.print(`  ${dim("warnings:")}\n`);
      for (const warning of captureResult.warnings) {
        cli.print(`    - ${warning}\n`);
      }
    }
  }
}
```

### Step 6.4: Run specs
```bash
npx proby src/private/utils/create/register-powerup.spec.ts
```

**Expected:** 4 tests pass, 0 fail.

---

## Phase 7: Update create-powerup

### Step 7.1: Update `outputPath` default
**File:** `.powerups/installed/_internal/create-powerup/index.ts`

Change `outputPath` default from `.powerups/_internal` to `.powerups/installed/_internal`:

```ts
defaults: {
  outputPath: ".powerups/installed/_internal",
  powerupType: "single-use",
},
```

### Step 7.2: Update `dist/instructions.json`
**File:** `.powerups/installed/_internal/create-powerup/dist/instructions.json`

Change `outputPath` default in the compiled JSON to match.

### Step 7.3: Verify no spec breakage
The create-powerup's own templates still work — the `outputPath` is always passed explicitly by the create command, so the default is just a fallback.

---

## Phase 8: Wire Up `create-new.ts`

### Step 8.1: Complete the command
**File:** `packages/cli/src/private/commands/create/create-new.ts`

Add all flags, implement the action:

```ts
import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import fs from "@rcompat/fs";

import checkForPreCreateErrors from "#utils/create/check-for-pre-create-errors/index";
import buildVariables from "#utils/create/build-variables";
import captureFiles from "#utils/create/capture-files/index";
import registerPowerup from "#utils/create/register-powerup";
import printCreateSummary from "#utils/create/print-create-summary";

import getPowerup from "#utils/use/get-powerup/getPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import runPowerup from "#utils/use/run-powerup/index";

const dryRunFlag: Flag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print output to stdout instead of writing files",
};

const captureFlag: Flag = {
  name: "capture", long: "capture", short: "c",
  description: `Capture files into the new ${SINGULAR_NAME_FOR_CLI}: "all" or "workingDir"`,
};

const localFlag: Flag = {
  name: "local", long: "local", short: "l",
  description: "Create locally (default: global)",
};

const descriptionFlag: Flag = {
  name: "description", long: "description", short: "d",
  description: "Human-readable description (required)",
};

const intentFlag: Flag = {
  name: "intent", long: "intent", short: "i",
  description: "Comma-separated intent keywords",
};

const variablesFlag: Flag = {
  name: "variables", long: "variables", short: "v",
  description: "Comma-separated required variable names",
};

const optionalVariablesFlag: Flag = {
  name: "optionalVariables", long: "optional-variables", short: "ov",
  description: "Comma-separated optional variable names",
};

const typeFlag: Flag = {
  name: "type", long: "type", short: "t",
  description: `Powerup type: multi-use or single-use (defaults to single-use)`,
};

const create = new Command({
  name: "create",
  description: `Create a ${SINGULAR_NAME_FOR_CLI}`,
  flags: [dryRunFlag, captureFlag, localFlag, descriptionFlag, intentFlag, variablesFlag, optionalVariablesFlag, typeFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const projectRoot: FileRef = context?.root ?? await runtime.projectRoot();
    const isDryRun = is.defined(flags.dryRun);
    const isLocal = is.defined(flags.local);
    const powerupName = subcommands?.[0];

    const destination = isLocal ? projectRoot : fs.ref(GLOBAL_ROOT);
    const outputPath = isLocal
      ? `${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}`
      : INSTALLED_FOLDER.internal;

    await checkForPreCreateErrors({
      powerupName,
      captureValue: flags.capture,
      description: flags.description,
      isLocal,
      powerupDirectory: destination.append(`/${outputPath}`),
      projectRoot,
      globalRoot: fs.ref(GLOBAL_ROOT),
    });

    const powerup = await getPowerup({
      root: projectRoot,
      name: "create-powerup",
      globalRoot: fs.ref(GLOBAL_ROOT),
    });

    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(
      powerup.instructions,
    );

    const variables = buildVariables({
      name: powerupName!,
      description: flags.description,
      intent: flags.intent,
      requiredVariables: flags.variables,
      optionalVariables: flags.optionalVariables,
      powerupType: flags.type,
      outputPath,
    });

    await runPowerup({
      destination,
      powerupDirectory: powerup.location,
      instructions: validatedCompiledInstructions,
      isDryRun,
      variables,
      powerupVersion: powerup.version,
      powerupLocation: powerup.location.path,
    });

    let captureResult;
    if (is.defined(flags.capture)) {
      const newPowerupDirectory = destination.append(`/${outputPath}/${powerupName}`);
      const indexFilePath = newPowerupDirectory.append("/index.ts");
      captureResult = await captureFiles({
        captureMode: flags.capture as "all" | "workingDir",
        projectRoot,
        workingDir: projectRoot,
        newPowerupDirectory,
        indexFilePath,
        isDryRun,
      });
    }

    if (!isDryRun) {
      await registerPowerup({ name: powerupName!, isLocal, projectRoot });
    }

    printCreateSummary({ name: powerupName!, isDryRun, captureResult });
  },
});

export default create;
```

### Step 8.2: Write `create.spec.ts`
**File:** `packages/cli/src/private/commands/create/create.spec.ts`

Integration tests. These need the real create-powerup installed (it is, in `.powerups/installed/_internal/create-powerup/`).

Integration tests — use `setupTestDir`/`cleanup` pattern. Each test needs:
- A test dir with `.powerups/config.json` containing `["internal:create-powerup"]`
- The create-powerup installed at `.powerups/installed/_internal/create-powerup/` (copy `dist/`, `package.json`, `templates/` from the real installation, or use a test fixture)
- Use `--local` flag to avoid writing to the actual global root

Tests (follow `#test-utils/test/index` pattern, use `throwsAsync` for async throws):
1. "should create a new local powerup without errors" — run with `--description` and `--local` flags, verify `index.ts`, `package.json`, `tsconfig.json`, `.gitignore` exist in `.powerups/installed/_internal/<name>/`
2. "should not create any files in dry-run mode" — same flags + `--dry-run`, verify no files created
3. "should throw missing_name when no powerup name is passed as subcommand"
4. "should throw missing_description when description flag is not passed"
5. "should throw invalid_capture when an invalid capture value is passed"
6. "should throw already_exists when the powerup directory already exists" — pre-create the target directory
7. "should create a powerup with type multi-use when --type flag is passed" — verify `type: "multi-use"` in generated `index.ts`

Note: Tests must use `--local` flag to avoid writing to the actual global root. The test root needs a `.powerups/config.json` with `create-powerup` registered for `getPowerup` to find it. Pattern: set up test dir with `.powerups/installed/_internal/create-powerup/` (copy from real installation or symlink), `.powerups/config.json` with `["internal:create-powerup"]`.

### Step 8.3: Run specs
```bash
npx proby src/private/commands/create/create.spec.ts
```

**Expected:** 7 tests pass, 0 fail.

---

## Phase 9: Type Check & Cleanup

### Step 9.1: Type check
```bash
cd packages/cli && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Verify no NEW type errors in the new files. Pre-existing errors (18) may remain.

### Step 9.2: Run all new specs together
```bash
for f in \
  src/private/errors/createErrors.spec.ts \
  src/private/utils/create/check-for-pre-create-errors/index.spec.ts \
  src/private/utils/create/build-variables.spec.ts \
  src/private/utils/create/capture-files/wrap-as-template.spec.ts \
  src/private/utils/create/capture-files/generate-step-name.spec.ts \
  src/private/utils/create/capture-files/git-status.spec.ts \
  src/private/utils/create/capture-files/diff-to-modifications.spec.ts \
  src/private/utils/create/capture-files/capture-all-files.spec.ts \
  src/private/utils/create/capture-files/capture-working-dir.spec.ts \
  src/private/utils/create/capture-files/add-steps-to-index.spec.ts \
  src/private/utils/create/register-powerup.spec.ts \
  src/private/commands/create/create.spec.ts; do
  npx proby "$f"
done
```

### Step 9.3: Verify existing specs still pass
```bash
npx proby src/private/utils/use/run-powerup/run-powerup.spec.ts
npx proby src/private/utils/use/run-powerup/run-step.spec.ts
npx proby src/private/utils/use/extract-variables.spec.ts
```

### Step 9.4: Remove old `utils/create/` code (deferred)

**NOT in this implementation round.** The old `utils/create/` files are still imported by the old `create/index.ts` command. Removing them would break the old command. Wait until `create-new.ts` fully replaces `create/index.ts` (wire-up in the CLI entrypoint), then remove old code in a separate commit.

Old files to remove (eventually):
- `utils/create/create-powerup.ts`
- `utils/create/create-powerup.spec.ts`
- `utils/create/get-package-deps.ts`
- `utils/create/git/` (entire directory)
- `utils/create/steps/` (entire directory)

### Step 9.5: Commit
```bash
git add -A
git commit -m "feat: implement new create command with capture and dogfooding"
```

---

## Summary: Files to Create/Modify

### New files (30):
1. `packages/cli/src/private/utils/create/check-for-pre-create-errors/index.ts`
2. `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-name-was-passed.ts`
3. `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-capture-flag-valid.ts`
4. `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-description-was-passed.ts`
5. `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-powerup-does-not-exist.ts`
6. `packages/cli/src/private/utils/create/check-for-pre-create-errors/check-folder-structure-exists.ts`
7. `packages/cli/src/private/utils/create/check-for-pre-create-errors/index.spec.ts`
8. `packages/cli/src/private/utils/create/build-variables.ts`
9. `packages/cli/src/private/utils/create/build-variables.spec.ts`
10. `packages/cli/src/private/utils/create/capture-files/index.ts`
11. `packages/cli/src/private/utils/create/capture-files/capture-all-files.ts`
12. `packages/cli/src/private/utils/create/capture-files/capture-all-files.spec.ts`
13. `packages/cli/src/private/utils/create/capture-files/capture-working-dir.ts`
14. `packages/cli/src/private/utils/create/capture-files/capture-working-dir.spec.ts`
15. `packages/cli/src/private/utils/create/capture-files/wrap-as-template.ts`
16. `packages/cli/src/private/utils/create/capture-files/wrap-as-template.spec.ts`
17. `packages/cli/src/private/utils/create/capture-files/generate-step-name.ts`
18. `packages/cli/src/private/utils/create/capture-files/generate-step-name.spec.ts`
19. `packages/cli/src/private/utils/create/capture-files/git-status.ts`
20. `packages/cli/src/private/utils/create/capture-files/git-status.spec.ts`
21. `packages/cli/src/private/utils/create/capture-files/diff-to-modifications.ts`
22. `packages/cli/src/private/utils/create/capture-files/diff-to-modifications.spec.ts`
23. `packages/cli/src/private/utils/create/capture-files/add-steps-to-index.ts`
24. `packages/cli/src/private/utils/create/capture-files/add-steps-to-index.spec.ts`
25. `packages/cli/src/private/utils/create/register-powerup.ts`
26. `packages/cli/src/private/utils/create/register-powerup.spec.ts`
27. `packages/cli/src/private/utils/create/print-create-summary.ts`
28. `packages/cli/src/private/utils/create/capture-files/create-steps-from-new-files.ts`
29. `packages/cli/src/private/utils/create/capture-files/create-steps-from-modified-files.ts`
30. `packages/cli/src/private/utils/create/capture-files/create-steps-from-deleted-files.ts`

### Modified files (4):
1. `packages/cli/src/private/errors/createErrors.ts` — add/remove errors
2. `packages/cli/src/private/commands/create/create-new.ts` — complete the command
3. `packages/cli/src/private/commands/create/create.spec.ts` — integration tests
4. `.powerups/installed/_internal/create-powerup/index.ts` — update `outputPath` default
5. `.powerups/installed/_internal/create-powerup/dist/instructions.json` — update `outputPath` default

### Reused (imported, not recreated):
- `getPowerup` from `#utils/use/get-powerup/getPowerup`
- `checkCompiledInstructionsForErrors` from `#utils/validate/check-compiled-instructions-for-errors/index`
- `runPowerup` from `#utils/use/run-powerup/index`
- `addPackageToConfig`, `addPackageToGlobalConfig` from `#utils/config`
- `ResolvedVariable` type from `#utils/variables`
- `Modification` type from `#schemas/modification`
- `Step`, `Instructions` types from `@liolocs/powerups-sdk`

### Phase order:
1. Phase 1: Update `createErrors.ts` (+ spec)
2. Phase 2: Pre-create validation (+ spec)
3. Phase 3: Build variables (+ spec)
4. Phase 4: Capture shared utilities (wrap-as-template, generate-step-name, git-status, diff-to-modifications) (+ specs)
5. Phase 5: Capture implementations (capture-all-files, capture-working-dir, add-steps-to-index, dispatcher) (+ specs)
6. Phase 6: Registration & summary (+ spec)
7. Phase 7: Update create-powerup outputPath default
8. Phase 8: Wire up `create-new.ts` (+ integration spec)
9. Phase 9: Type check, run all specs, commit