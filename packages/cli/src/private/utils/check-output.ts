import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { TEMPLATE_FOLDER } from "#constants";
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

  // Validate variable declarations
  const required = instructions.variables.required;
  const optional = instructions.variables.optional ?? [];

  // a) Required/optional name collision
  for (const opt of optional) {
    const collision = required.some(r => r.toLowerCase() === opt.toLowerCase());
    if (collision) {
      issues.push(`variable "${opt}" is declared as both required and optional`);
    }
  }

  // b) Optional variable used in an output path
  const pathVariables = new Set<string>();
  for (const file of [...instructions.output.create, ...instructions.output.modify]) {
    for (const [, token] of file.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
      pathVariables.add(token);
    }
  }
  for (const file of instructions.output.delete ?? []) {
    for (const [, token] of file.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
      pathVariables.add(token);
    }
  }
  for (const pathVar of pathVariables) {
    const isOptionalVar = optional.some(
      v => v.toLowerCase() === pathVar.toLowerCase(),
    );
    if (isOptionalVar) {
      issues.push(
        `variable "${pathVar}" is used in an output path but declared optional; it should be required`,
      );
    }
  }

  for (const file of instructions.output.create) {
    const templatePath = currentOutputDir.append(`/${TEMPLATE_FOLDER}/${file.template}`);
    if (!(await fs.exists(templatePath))) {
      issues.push(`missing template file: ${file.template}`);
    }
  }

  for (const file of instructions.output.modify) {
    const templatePath = currentOutputDir.append(`/${TEMPLATE_FOLDER}/${file.template}`);
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