import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { validatePatternTree } from "#utils/validate-pattern";

/**
 * Full pattern validation: schema conformance, template file existence,
 * and subpattern tree integrity. Returns a list of issue strings
 * (empty = valid). Never throws on a validation failure.
 */
export async function checkPattern(args: {
  rootPatternDir: FileRef;
  currentPatternDir: FileRef;
}): Promise<string[]> {
  const { rootPatternDir, currentPatternDir } = args;
  const patternPath = currentPatternDir.append("/instructions.json");
  const issues: string[] = [];

  if (!(await fs.exists(patternPath))) {
    return ["instructions.json not found"];
  }

  let instructions: Instructions;
  try {
    instructions = instructionsSchema.parse(await patternPath.json());
  } catch (error_) {
    // pema ParseError.message is already humanized with the field path.
    issues.push(error_ instanceof Error ? error_.message : String(error_));
    // Schema is broken -> template refs and includes are unreliable, stop here.
    return issues;
  }

  for (const file of instructions.output.files) {
    const templatePath = currentPatternDir.append(`/${file.template}`);
    if (!(await fs.exists(templatePath))) {
      issues.push(`missing template file: ${file.template}`);
    }
  }

  // Validate subpattern tree
  const treeIssues = await validatePatternTree({
    rootPatternDir,
    currentPatternDir,
  });
  issues.push(...treeIssues);

  return issues;
}