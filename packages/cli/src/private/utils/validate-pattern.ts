import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";

/**
 * Validate the subpattern tree of a pattern. Walks all includes recursively,
 * checking: existence, circular references, variable mapping completeness,
 * parentVar reference validity, and override file name validity.
 *
 * Returns a list of issue strings (empty = valid). Does not throw.
 */
export async function validatePatternTree(args: {
  rootPatternDir: FileRef;
  currentPatternDir: FileRef;
  pathStack?: string[];
}): Promise<string[]> {
  const { rootPatternDir, currentPatternDir } = args;
  const currentName = currentPatternDir.name;
  const pathStack = [...(args.pathStack ?? []), currentName];
  const issues: string[] = [];

  const patternPath = currentPatternDir.append("/instructions.json");

  if (!(await fs.exists(patternPath))) {
    return ["instructions.json not found"];
  }

  let instructions: Instructions;
  try {
    instructions = instructionsSchema.parse(await patternPath.json());
  } catch {
    return [`instructions.json parse failed: ${currentPatternDir.name}`];
  }

  if (!instructions.includes) {
    return issues;
  }

  for (const ref of instructions.includes) {
    // a. Existence
    const subpatternDir = rootPatternDir.append(`/${ref.name}`);
    if (!(await fs.exists(subpatternDir))) {
      issues.push(`subpattern not found: ${ref.name}`);
      continue;
    }

    // b. Cycle
    if (pathStack.includes(ref.name)) {
      const chain = [...pathStack, ref.name];
      issues.push(`circular reference: ${chain.join(" → ")}`);
      continue;
    }

    // c. Load subpattern instructions
    const subPatternPath = subpatternDir.append("/instructions.json");
    let subInstructions: Instructions;
    try {
      subInstructions = instructionsSchema.parse(await subPatternPath.json());
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
        issues.push(`unmapped variable: ${declared} in subpattern: ${ref.name}`);
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
          issues.push(`invalid reference: {{${varName}}} in subpattern: ${ref.name}`);
        }
      }
    }

    // f. Override file names — must match a file name in subpattern's output.files
    if (ref.files) {
      for (const fileName of Object.keys(ref.files)) {
        const found = subInstructions.output.files.find(
          f => f.name === fileName,
        );
        if (!found) {
          issues.push(`override file not found: ${fileName} in subpattern: ${ref.name}`);
        }
      }
    }

    // g. Recurse
    const childIssues = await validatePatternTree({
      rootPatternDir,
      currentPatternDir: subpatternDir,
      pathStack,
    });
    issues.push(...childIssues);
  }

  return issues;
}