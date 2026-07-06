import type { FileRef } from "@rcompat/fs";
import { instructionsSchema } from "#schemas/instruction";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";

export interface RenderTask {
  templatePath: FileRef;
  variables: VariableResult;
  outputPath: string;
}

/**
 * Resolve a pattern (and all its subpatterns) into a flat list of render tasks.
 * Assumes the tree has already been validated by checkPattern.
 *
 * For each output file: creates a RenderTask with the template path, the
 * current pattern's resolved variables, and the output path (overridden if
 * the parent specified one for this file name).
 *
 * For each subpattern: resolves the variable mapping (replacing {{parentVar}}
 * tokens with parent variable values), then recurses.
 */
export async function resolvePattern(args: {
  patternName: string;
  variables: VariableResult;
  patternsFolder: FileRef;
  overrides?: Record<string, string>;
}): Promise<RenderTask[]> {
  const { patternName, variables, patternsFolder } = args;
  const overrides = args.overrides ?? {};

  const patternFolder = patternsFolder.append(`/${patternName}`);
  const patternPath = patternFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await patternPath.json());

  const tasks: RenderTask[] = [];

  // Own output files
  for (const file of instructions.output.files) {
    const outputPath = overrides[file.name] ?? file.outputPath;
    tasks.push({
      templatePath: patternFolder.append(`/${file.template}`),
      variables,
      outputPath,
    });
  }

  // Subpatterns
  if (instructions.includes) {
    for (const ref of instructions.includes) {
      // Resolve variable mapping: replace {{parentVar}} tokens with parent values
      const subVariables: VariableResult = {};
      for (const [key, value] of Object.entries(ref.variables)) {
        subVariables[key] = resolveTemplateString(value, variables);
      }

      const childTasks = await resolvePattern({
        patternName: ref.name,
        variables: subVariables,
        patternsFolder,
        overrides: ref.files ?? {},
      });

      tasks.push(...childTasks);
    }
  }

  return tasks;
}