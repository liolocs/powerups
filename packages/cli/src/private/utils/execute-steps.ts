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