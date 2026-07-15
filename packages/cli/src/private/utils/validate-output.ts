import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import is from "@rcompat/is";

/**
 * Validate the suboutput tree of a output. Walks all includes recursively,
 * checking: existence, circular references, variable mapping completeness,
 * parentVar reference validity, and override file name validity.
 *
 * Returns a list of issue strings (empty = valid). Does not throw.
 */
export async function validateOutputTree(args: {
  rootOutputDir: FileRef;
  currentOutputDir: FileRef;
  pathStack?: string[];
}): Promise<string[]> {
  const { rootOutputDir, currentOutputDir } = args;
  const currentName = currentOutputDir.name;
  const pathStack = [...(args.pathStack ?? []), currentName];
  const issues: string[] = [];

  const outputPath = currentOutputDir.append("/instructions.json");

  if (!(await fs.exists(outputPath))) {
    return ["instructions.json not found"];
  }

  let instructions: Instructions;
  try {
    instructions = instructionsSchema.parse(await outputPath.json());
  } catch {
    return [`instructions.json parse failed: ${currentOutputDir.name}`];
  }

  if (is.defined(instructions.includes) === false) {
    return issues;
  }

  for (const ref of instructions.includes) {
    // a. Existence
    const suboutputDir = rootOutputDir.append(`/${ref.name}`);
    if (!(await fs.exists(suboutputDir))) {
      issues.push(`suboutput not found: ${ref.name}`);
      continue;
    }

    // b. Cycle
    if (pathStack.includes(ref.name)) {
      const chain = [...pathStack, ref.name];
      issues.push(`circular reference: ${chain.join(" → ")}`);
      continue;
    }

    // c. Load suboutput instructions
    const subOutputPath = suboutputDir.append("/instructions.json");
    let subInstructions: Instructions;
    try {
      subInstructions = instructionsSchema.parse(await subOutputPath.json());
    } catch {
      issues.push(`instructions.json parse failed: ${ref.name}`);
      continue;
    }

    // Every declared variable (required + optional) must have a mapping key
    const subAllVariables = [
      ...subInstructions.variables.required,
      ...(subInstructions.variables.optional ?? []),
    ];
    for (const declared of subAllVariables) {
      const mapped = Object.keys(ref.variables).find(
        k => k.toLowerCase() === declared.toLowerCase(),
      );

      if (is.falsy(mapped)) {
        issues.push(`unmapped variable: ${declared} in suboutput: ${ref.name}`);
      }
    }

    // {{parentVar}} tokens must refer to parent's declared variables
    for (const value of Object.values(ref.variables)) {
      const tokens = value.match(/\{\{(\w+)\}\}/g) ?? [];
      for (const token of tokens) {
        const varName = token.slice(2, -2);
        const allParentVariables = [
          ...instructions.variables.required,
          ...(instructions.variables.optional ?? []),
        ];
        const declared = allParentVariables.find(
          v => v.toLowerCase() === varName.toLowerCase(),
        );

        if (is.falsy(declared)) {
          issues.push(`invalid reference: {{${varName}}} in suboutput: ${ref.name}`);
        }
      }
    }

    // f. Override file names must match a file name in suboutput's output.create or output.modify
    if (is.defined(ref.outputPathOverride)) {
      if (is.defined(ref.outputPathOverride.create)) {
        for (const fileName of Object.keys(ref.outputPathOverride.create)) {
          const found = subInstructions.output.create.find(
            f => f.name === fileName,
          );
          if (is.falsy(found)) {
            issues.push(`override file not found: ${fileName} in suboutput: ${ref.name}`);
          }
        }
      }
      if (is.defined(ref.outputPathOverride.modify)) {
        for (const fileName of Object.keys(ref.outputPathOverride.modify)) {
          const found = subInstructions.output.modify.find(
            f => f.name === fileName,
          );
          if (is.falsy(found)) {
            issues.push(`override file not found: ${fileName} in suboutput: ${ref.name}`);
          }
        }
      }
      if (is.defined(ref.outputPathOverride.delete)) {
        for (const fileName of Object.keys(ref.outputPathOverride.delete)) {
          const found = subInstructions.output.delete?.find(
            f => f.name === fileName,
          );
          if (is.falsy(found)) {
            issues.push(`override file not found: ${fileName} in suboutput: ${ref.name}`);
          }
        }
      }
    }

    // g. Recurse
    const childIssues = await validateOutputTree({
      rootOutputDir,
      currentOutputDir: suboutputDir,
      pathStack,
    });
    issues.push(...childIssues);
  }

  return issues;
}