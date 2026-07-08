import { modificationArraySchema } from "#schemas/modification";
import type { Modification } from "#schemas/modification";
import { runTemplate } from "#runners/output/index";
import type { FileRef } from "@rcompat/fs";
import type { VariableResult } from "#utils/variables";
import fs from "@rcompat/fs";

export interface ModifyTask {
  templatePath: FileRef;
  outputPath: string; // relative to project root
  variables: VariableResult;
}

export interface AppliedModification {
  outputPath: string;
  content: string; // modified file content
}

export interface ModifyErrorSet {
  modify_target_not_found: (path: string) => Error;
  modify_anchor_not_found: (anchor: string, path: string) => Error;
  modify_anchor_ambiguous: (anchor: string, path: string) => Error;
  modify_template_invalid_json: (template: string) => Error;
}

/**
 * Parse a modify template file into an array of Modification entries.
 * - .json: parse directly (no variable substitution)
 * - .njk/.ts: render through runner, then JSON.parse the output
 */
export async function parseModifyTemplate(
  templatePath: FileRef,
  variables: VariableResult,
  errors: ModifyErrorSet,
): Promise<Modification[]> {
  const ext = templatePath.extension;
  let json: string;

  if (ext === ".json") {
    json = await templatePath.text();
  } else {
    json = await runTemplate({ templatePath, variables });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw errors.modify_template_invalid_json(templatePath.name);
  }

  return modificationArraySchema.parse(parsed);
}

/**
 * Apply a single Modification to the file content string.
 * Returns the modified content.
 */
export function applySingleModification({
  content,
  mod,
  outputPath,
  errors,
}: {
  content: string;
  mod: Modification;
  outputPath: string;
  errors: ModifyErrorSet;
}): string {
  const where = mod.where;

  if (where === "top") {
    return mod.content + content;
  }

  if (where === "bottom") {
    return content + mod.content;
  }

  if (typeof where === "string") {
    // Replace: find exact string, must be unique
    const foundStringCount = content.split(where).length - 1;

    if (foundStringCount === 0) {
      throw errors.modify_anchor_not_found(where, outputPath);
    }

    if (foundStringCount > 1) {
      throw errors.modify_anchor_ambiguous(where, outputPath);
    }

    return content.replace(where, mod.content);
  }

  if ("after" in where) {
    const afterIndex = content.indexOf(where.after);
    const hasAfter = afterIndex !== -1;

    if (!hasAfter) {
      throw errors.modify_anchor_not_found(where.after, outputPath);
    }

    const insertPos = afterIndex + where.after.length;

    return content.slice(0, insertPos) + mod.content + content.slice(insertPos);
  }

  if ("before" in where) {
    const beforeIndex = content.indexOf(where.before);
    const hasBefore = beforeIndex !== -1;

    if (!hasBefore) {
      throw errors.modify_anchor_not_found(where.before, outputPath);
    }

    return content.slice(0, beforeIndex) + mod.content + content.slice(beforeIndex);
  }

  return content;
}

/**
 * Apply all modifications from a modify template to a file.
 * Reads the target file, applies each modification sequentially,
 * returns the modified content.
 */
export async function applyMultipleModifications(
  task: ModifyTask,
  rootDir: FileRef,
  errors: ModifyErrorSet,
): Promise<AppliedModification> {
  // Read target file
  const targetPath = rootDir.append(`/${task.outputPath}`);
  if (!(await fs.exists(targetPath))) {
    throw errors.modify_target_not_found(task.outputPath);
  }
  const content = await targetPath.text();

  const modifications = await parseModifyTemplate(
    task.templatePath,
    task.variables,
    errors,
  );

  // Apply each modification sequentially
  let result = content;

  for (const mod of modifications) {
    result = applySingleModification({
      content: result,
      mod,
      outputPath: task.outputPath,
      errors,
    });
  }

  return { outputPath: task.outputPath, content: result };
}