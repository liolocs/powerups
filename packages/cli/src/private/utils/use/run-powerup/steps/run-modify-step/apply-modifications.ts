import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
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
    const foundStringCount = content.split(where).length - 1;

    if (foundStringCount === 0) {
      throw use_errors.modify_anchor_not_found(where, outputPath);
    }

    if (foundStringCount > 1) {
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

  let result = content;

  for (const modification of modifications) {
    result = applySingleModification({
      content: result,
      modification,
      outputPath,
    });
  }

  return result;
}