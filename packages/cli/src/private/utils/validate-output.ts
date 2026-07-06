import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";

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

  if (!instructions.includes) {
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

    // d. Variable completeness — every declared variable must have a mapping key
    for (const declared of subInstructions.variables) {
      const mapped = Object.keys(ref.variables).find(
        k => k.toLowerCase() === declared.toLowerCase(),
      );
      if (!mapped) {
        issues.push(`unmapped variable: ${declared} in suboutput: ${ref.name}`);
      }
    }

    // e. Reference validity — {{parentVar}} tokens must refer to parent's declared variables
    for (const value of Object.values(ref.variables)) {
      const tokens = value.match(/\{\{(\w+)\}\}/g) ?? [];
      for (const token of tokens) {
        const varName = token.slice(2, -2);
        const declared = instructions.variables.find(
          v => v.toLowerCase() === varName.toLowerCase(),
        );
        if (!declared) {
          issues.push(`invalid reference: {{${varName}}} in suboutput: ${ref.name}`);
        }
      }
    }

    // f. Override file names — must match a file name in suboutput's output.files
    if (ref.files) {
      for (const fileName of Object.keys(ref.files)) {
        const found = subInstructions.output.files.find(
          f => f.name === fileName,
        );
        if (!found) {
          issues.push(`override file not found: ${fileName} in suboutput: ${ref.name}`);
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