import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { validateOutputTree } from "#utils/validate-output";

/**
 * Full output validation: schema conformance, template file existence,
 * and suboutput tree integrity. Returns a list of issue strings
 * (empty = valid). Never throws on a validation failure.
 */
export async function checkOutput(args: {
  rootOutputDir: FileRef;
  currentOutputDir: FileRef;
}): Promise<string[]> {
  const { rootOutputDir, currentOutputDir } = args;
  const outputPath = currentOutputDir.append("/instructions.json");
  const issues: string[] = [];

  if (!(await fs.exists(outputPath))) {
    return ["instructions.json not found"];
  }

  let instructions: Instructions;
  try {
    instructions = instructionsSchema.parse(await outputPath.json());
  } catch (error_) {
    // pema ParseError.message is already humanized with the field path.
    issues.push(error_ instanceof Error ? error_.message : String(error_));
    // Schema is broken -> template refs and includes are unreliable, stop here.
    return issues;
  }

  for (const file of instructions.output.files) {
    const templatePath = currentOutputDir.append(`/${file.template}`);
    if (!(await fs.exists(templatePath))) {
      issues.push(`missing template file: ${file.template}`);
    }
  }

  // Validate suboutput tree
  const treeIssues = await validateOutputTree({
    rootOutputDir,
    currentOutputDir,
  });
  issues.push(...treeIssues);

  return issues;
}