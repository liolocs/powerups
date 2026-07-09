import type { FileRef } from "@rcompat/fs";
import { instructionsSchema } from "#schemas/instruction";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import is from "@rcompat/is";

export interface RenderTask {
  kind: "create" | "modify" | "delete";
  templatePath?: FileRef;
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
  createOverrides?: Record<string, string>;
  modifyOverrides?: Record<string, string>;
  deleteOverrides?: Record<string, string>;
}): Promise<RenderTask[]> {
  const { outputName, variables, outputsFolder } = args;
  const createOverrides = args.createOverrides ?? {};
  const modifyOverrides = args.modifyOverrides ?? {};
  const deleteOverrides = args.deleteOverrides ?? {};

  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const tasks: RenderTask[] = [];

  // Own create files
  for (const file of instructions.output.create) {
    let fileOutputPath = file.outputPath;

    if (is.defined(createOverrides[file.name])) {
      fileOutputPath = createOverrides[file.name];
    }

    tasks.push({
      kind: "create",
      templatePath: outputFolder.append(`/${file.template}`),
      variables,
      outputPath: fileOutputPath,
    });
  }

  // Own modify files
  for (const file of instructions.output.modify) {
    let fileOutputPath = file.outputPath;

    if (is.defined(modifyOverrides[file.name])) {
      fileOutputPath = modifyOverrides[file.name];
    }

    tasks.push({
      kind: "modify",
      templatePath: outputFolder.append(`/${file.template}`),
      variables,
      outputPath: fileOutputPath,
    });
  }

  // Own delete files
  for (const file of instructions.output.delete ?? []) {
    let fileOutputPath = file.outputPath;

    if (is.defined(deleteOverrides[file.name])) {
      fileOutputPath = deleteOverrides[file.name];
    }

    tasks.push({
      kind: "delete",
      variables,
      outputPath: fileOutputPath,
    });
  }

  // Suboutputs
  if (is.defined(instructions.includes)) {
    for (const ref of instructions.includes) {
      // Replace {{parentVar}} tokens with parent values
      const subVariables: VariableResult = {};
      for (const [key, value] of Object.entries(ref.variables)) {
        subVariables[key] = resolveTemplateString(value, variables);
      }

      const childCreateOverrides = ref.outputPathOverride?.create ?? {};
      const childModifyOverrides = ref.outputPathOverride?.modify ?? {};
      const childDeleteOverrides = ref.outputPathOverride?.delete ?? {};

      const childTasks = await resolveOutput({
        outputName: ref.name,
        variables: subVariables,
        outputsFolder,
        createOverrides: childCreateOverrides,
        modifyOverrides: childModifyOverrides,
        deleteOverrides: childDeleteOverrides,
      });

      tasks.push(...childTasks);
    }
  }

  return tasks;
}