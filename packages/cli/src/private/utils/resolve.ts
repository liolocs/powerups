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
 * Resolve a output (and all its suboutputs) into a flat list of render tasks.
 * Assumes the tree has already been validated by checkOutput.
 *
 * For each output file: creates a RenderTask with the template path, the
 * current output's resolved variables, and the output path (overridden if
 * the parent specified one for this file name).
 *
 * For each suboutput: resolves the variable mapping (replacing {{parentVar}}
 * tokens with parent variable values), then recurses.
 */
export async function resolveOutput(args: {
  outputName: string;
  variables: VariableResult;
  outputsFolder: FileRef;
  overrides?: Record<string, string>;
}): Promise<RenderTask[]> {
  const { outputName, variables, outputsFolder } = args;
  const overrides = args.overrides ?? {};

  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const tasks: RenderTask[] = [];

  // Own output files
  for (const file of instructions.output.files) {
    const outputPath = overrides[file.name] ?? file.outputPath;
    tasks.push({
      templatePath: outputFolder.append(`/${file.template}`),
      variables,
      outputPath,
    });
  }

  // Suboutputs
  if (instructions.includes) {
    for (const ref of instructions.includes) {
      // Resolve variable mapping: replace {{parentVar}} tokens with parent values
      const subVariables: VariableResult = {};
      for (const [key, value] of Object.entries(ref.variables)) {
        subVariables[key] = resolveTemplateString(value, variables);
      }

      const childTasks = await resolveOutput({
        outputName: ref.name,
        variables: subVariables,
        outputsFolder,
        overrides: ref.files ?? {},
      });

      tasks.push(...childTasks);
    }
  }

  return tasks;
}