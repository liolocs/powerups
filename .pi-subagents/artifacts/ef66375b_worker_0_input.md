# Task for worker

You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Do not continue or answer prior messages as if they are waiting for a reply. Your sole job is to execute the task below and return a focused result for that task using your tools.

Task:
You are implementing Task 2 and Task 3 from the steps+read implementation plan.

## Task 2: New Error Codes (`useErrors.ts`)

**File:** `packages/cli/src/private/errors/useErrors.ts`

Add these three error entries to the `use_errors` object (the `error.coded({...})` call), after the existing `template_not_found` entry:

```typescript
  read_file_not_found: (path: string) => {
    const errorText = `Read step target file not found: ${path}`;
    return t`${errorBGText}${errorText}`;
  },

  read_json_path_not_found: (path: string, jsonPath: string) => {
    const errorText = `JSON path "${jsonPath}" not found in: ${path}`;
    return t`${errorBGText}${errorText}`;
  },

  read_json_parse_error: (path: string) => {
    const errorText = `Read step target is not valid JSON: ${path}`;
    return t`${errorBGText}${errorText}`;
  },
```

After adding, commit:
```bash
cd packages/cli
git add src/private/errors/useErrors.ts
git commit -m "feat: add read step error codes"
```

## Task 3: navigateJsonPath helper + executeSteps function

**Files:**
- Create: `packages/cli/src/private/utils/execute-steps.ts`
- Create: `packages/cli/src/private/utils/execute-steps.spec.ts`

### Step 1: Create `execute-steps.ts`

Create `packages/cli/src/private/utils/execute-steps.ts` with the following implementation:

```typescript
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { instructionsSchema, type Step } from "#schemas/instruction";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import { runTemplate } from "#template-runners/index";
import { applyMultipleModifications } from "#utils/modify-engine";
import use_errors from "#errors/useErrors";
import type { ChangedFile } from "#utils/worktree";

/**
 * Navigate a dot-notation path into a parsed JSON object.
 * Returns the value at the path as a string.
 * Throws if the path doesn't exist.
 */
export function navigateJsonPath(json: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = json;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new Error(`JSON path "${path}" not found`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === undefined || current === null) {
    throw new Error(`JSON path "${path}" not found`);
  }

  return String(current);
}

export interface ExecuteStepsArgs {
  steps: Step[];
  variables: VariableResult;
  outputFolder: FileRef;
  rootDir: FileRef;
  worktreeRoot?: FileRef;
  outputsFolder: FileRef;
  isDryRun: boolean;
  isOverwrite: boolean;
  changedFiles: ChangedFile[];
}

/**
 * Execute a list of steps in order. Read steps mutate the variables map
 * in place, making new values available for subsequent steps.
 *
 * Returns totalCharacters rendered (for metrics).
 */
export async function executeSteps(args: ExecuteStepsArgs): Promise<number> {
  const { steps, variables, outputFolder, rootDir, outputsFolder,
          isDryRun, isOverwrite, changedFiles } = args;
  const worktreeRoot = args.worktreeRoot;
  let totalCharacters = 0;

  for (const step of steps) {
    switch (step.type) {
      case "read": {
        if (isDryRun) {
          variables[step.as] = step.as;
          break;
        }

        const resolvedPath = resolveTemplateString(step.path, variables);
        const targetPath = rootDir.append(`/${resolvedPath}`);

        if (!(await fs.exists(targetPath))) {
          throw use_errors.read_file_not_found(resolvedPath);
        }

        const content = await targetPath.text();
        let value: string;

        if (step.template) {
          value = await runTemplate({
            templatePath: outputFolder.append(`/${step.template}`),
            variables: { ...variables, __content: content },
          });
        } else if (step.jsonPath) {
          let json: unknown;
          try {
            json = JSON.parse(content);
          } catch {
            throw use_errors.read_json_parse_error(resolvedPath);
          }
          try {
            value = navigateJsonPath(json, step.jsonPath);
          } catch {
            throw use_errors.read_json_path_not_found(resolvedPath, step.jsonPath);
          }
        } else {
          value = content;
        }

        variables[step.as] = value;
        break;
      }

      case "create": {
        const outputPath = resolveTemplateString(step.outputPath, variables);

        if (isDryRun) {
          const templatePath = outputFolder.append(`/${step.template}`);
          if (!(await fs.exists(templatePath))) {
            throw use_errors.template_not_found(step.template);
          }
          const rendered = await runTemplate({ templatePath, variables });
          totalCharacters += rendered.length;
          cli.print(`=== ${outputPath} ===\n${rendered}\n\n`);
          break;
        }

        const templatePath = outputFolder.append(`/${step.template}`);
        if (!(await fs.exists(templatePath))) {
          throw use_errors.template_not_found(step.template);
        }

        const rendered = await runTemplate({ templatePath, variables });
        totalCharacters += rendered.length;

        const targetPath = worktreeRoot!.append(`/${outputPath}`);
        const targetExists = await fs.exists(targetPath);
        if (targetExists && !isOverwrite) {
          throw use_errors.destination_file_exists(outputPath);
        }

        await fs.create(targetPath.directory);
        await targetPath.write(rendered);
        changedFiles.push({
          worktreePath: targetPath.path,
          projectPath: outputPath,
        });
        cli.print(`Wrote ${outputPath}\n`);
        break;
      }

      case "modify": {
        const outputPath = resolveTemplateString(step.outputPath, variables);

        if (isDryRun) {
          const templatePath = outputFolder.append(`/${step.template}`);
          const ext = templatePath.extension;
          let modContent: string;
          if (ext === ".json") {
            modContent = await templatePath.text();
          } else {
            modContent = await runTemplate({ templatePath, variables });
          }
          totalCharacters += modContent.length;
          cli.print(`=== ${outputPath} (modify) ===\n${modContent}\n\n`);
          break;
        }

        try {
          const applied = await applyMultipleModifications({
            task: {
              templatePath: outputFolder.append(`/${step.template}`),
              outputPath,
              variables,
            },
            rootDir: worktreeRoot!,
            errors: use_errors,
          });
          totalCharacters += applied.content.length;

          const targetPath = worktreeRoot!.append(`/${outputPath}`);
          await fs.create(targetPath.directory);
          await targetPath.write(applied.content);
          changedFiles.push({
            worktreePath: targetPath.path,
            projectPath: outputPath,
          });
          cli.print(`Modified ${outputPath}\n`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          cli.print(`Warning: skipped modification for ${outputPath} — ${message}\n`);
        }
        break;
      }

      case "delete": {
        const outputPath = resolveTemplateString(step.outputPath, variables);

        if (isDryRun) {
          cli.print(`=== ${outputPath} (delete) ===\nWould delete\n\n`);
          break;
        }

        const targetPath = worktreeRoot!.append(`/${outputPath}`);
        const exists = await fs.exists(targetPath);
        if (!exists) {
          cli.print(`Warning: file not found, skipping: ${outputPath}\n`);
          break;
        }

        await targetPath.remove();
        changedFiles.push({
          worktreePath: targetPath.path,
          projectPath: outputPath,
          deleted: true,
        });
        cli.print(`Deleted ${outputPath}\n`);
        break;
      }

      case "include": {
        // 1. Build child variables — resolve {{parentVar}} tokens
        const childVariables: VariableResult = {};
        for (const [key, value] of Object.entries(step.variables)) {
          childVariables[key] = resolveTemplateString(value, variables);
        }

        // 2. Load child instructions
        const childFolder = outputsFolder.append(`/${step.name}`);
        const childInstructions = instructionsSchema.parse(
          await childFolder.append("/instructions.json").json(),
        );

        // 3. Apply excludeSteps + stepOverride
        const excludeSet = new Set(step.excludeSteps ?? []);
        let childSteps = childInstructions.steps.filter(s => !excludeSet.has(s.name));

        const overrides = step.stepOverride ?? {};
        childSteps = childSteps.map(s => {
          if (overrides[s.name]) {
            return { ...overrides[s.name], name: s.name } as Step;
          }
          return s;
        });

        // 4. Recurse — child gets its own variable scope
        const childChars = await executeSteps({
          steps: childSteps,
          variables: childVariables,
          outputFolder: childFolder,
          rootDir,
          worktreeRoot,
          outputsFolder,
          isDryRun,
          isOverwrite,
          changedFiles,
        });
        totalCharacters += childChars;
        break;
      }
    }
  }

  return totalCharacters;
}
```

### Step 2: Create `execute-steps.spec.ts`

Create `packages/cli/src/private/utils/execute-steps.spec.ts` with tests covering:

1. **navigateJsonPath** tests:
   - Returns top-level value: `navigateJsonPath({ name: "my-package" }, "name")` → `"my-package"`
   - Returns nested value: `navigateJsonPath({ dependencies: { express: "^4.0.0" } }, "dependencies.express")` → `"^4.0.0"`
   - Returns deeply nested value
   - Throws for non-existent path

2. **executeSteps: create step** tests:
   - Dry-run: renders template, prints to stdout, returns characters > 0
   - Real mode: writes file to worktreeRoot, tracks in changedFiles

3. **executeSteps: read step** tests:
   - jsonPath mode (real): reads file from rootDir, extracts value, mutates variables
   - Dry-run: sets variable to `as` value (e.g., `as: "packageName"` → `variables.packageName = "packageName"`)
   - Raw mode: stores entire file content
   - Throws for missing file
   - `{{token}}` in path resolves from variables

4. **executeSteps: include step** tests:
   - Recurses into child, creates files in worktree
   - excludeSteps skips matching child steps
   - stepOverride replaces child step's outputPath

5. **executeSteps: delete step** tests:
   - Real mode: removes file, tracks in changedFiles with deleted: true

6. **executeSteps: variable flow** tests:
   - Read step value flows to subsequent create step's outputPath

Use the existing test patterns from the codebase:
- `import test from "@rcompat/test"`
- `import fs, { type FileRef } from "@rcompat/fs"`
- `import runtime from "@rcompat/runtime"`
- Test setup creates temp directories under `root.append("/tmp")`
- Use `writeOutput(name, instructions, templates)` helper to create powerup dirs with instructions.json and template files

Key constants: `MAIN_FOLDER`, `ACTIVE_FOLDER`, `MULTI_USE_FOLDER` from `#constants`

### Step 3: Commit

```bash
cd packages/cli
git add src/private/utils/execute-steps.ts src/private/utils/execute-steps.spec.ts
git commit -m "feat: add executeSteps function replacing resolveOutput"
```

## Context

- This project uses pema for schema validation (similar to zod)
- The test framework is @rcompat/test with `test.case()` and `assert` pattern
- The test runner is proby (run via `npx proby`)
- Import pattern: `#schemas/instruction` → `./src/private/schemas/instruction.ts`
- The new schema (already committed in Task 1) exports: `instructionsSchema`, `stepSchema`, `stepsSchema`, `Step`, `StepOverrideValue`, `Instructions`
- `ChangedFile` type is exported from `#utils/worktree`: `{ worktreePath: string; projectPath: string; deleted?: boolean }`
- `VariableResult` is exported from `#utils/variables`: `Record<string, string>` (i.e. `{ [key: string]: string }`)
- `resolveTemplateString` from `#utils/resolve-template-string` resolves `{{var}}` tokens in a string using variables record
- `runTemplate` from `#template-runners/index` takes `{ templatePath: FileRef; variables: VariableResult }` and returns `Promise<string>`
- `applyMultipleModifications` from `#utils/modify-engine` takes `{ task: { templatePath: FileRef; outputPath: string; variables: VariableResult }; rootDir: FileRef; errors: typeof use_errors }` and returns `Promise<{ outputPath: string; content: string }>`

IMPORTANT: The test runner (proby) currently CANNOT run because other files in the project still import the old `outputSchema` from `#schemas/instruction`. This is expected — those files will be fixed in subsequent tasks. DO NOT try to run the full test suite. Instead, verify your code by:
1. Reading through it carefully for correctness
2. Checking that all imports resolve to real exports
3. Making sure the TypeScript compiles by running: `cd packages/cli && npx tsgo --noEmit` (or similar type check)

If you can't run the tests, that's OK — just make sure the code is correct and commit it.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```