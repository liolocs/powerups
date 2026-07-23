import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";

/**
 * Validate the suboutput tree of a powerup. Walks all include steps
 * recursively, checking: existence, circular references, variable mapping
 * completeness, parentVar reference validity, stepOverride name validity,
 * and excludeSteps name validity.
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

  // Collect all available parent variables (declared + read-produced by any read step)
  const allParentVariables = [
    ...instructions.variables.required,
    ...(instructions.variables.optional ?? []),
    ...instructions.steps
      .filter(s => s.type === "read")
      .map(s => (s as { as: string }).as),
  ];

  for (const step of instructions.steps) {
    if (step.type !== "include") continue;

    // a. Existence
    const suboutputDir = rootOutputDir.append(`/${step.name}`);
    if (!(await fs.exists(suboutputDir))) {
      issues.push(`suboutput not found: ${step.name}`);
      continue;
    }

    // b. Cycle
    if (pathStack.includes(step.name)) {
      const chain = [...pathStack, step.name];
      issues.push(`circular reference: ${chain.join(" → ")}`);
      continue;
    }

    // c. Load suboutput instructions
    const subOutputPath = suboutputDir.append("/instructions.json");
    let subInstructions: Instructions;
    try {
      subInstructions = instructionsSchema.parse(await subOutputPath.json());
    } catch {
      issues.push(`instructions.json parse failed: ${step.name}`);
      continue;
    }

    // Every declared variable (required + optional) must have a mapping key
    const subAllVariables = [
      ...subInstructions.variables.required,
      ...(subInstructions.variables.optional ?? []),
    ];
    for (const declared of subAllVariables) {
      const mapped = Object.keys(step.variables).find(
        k => k.toLowerCase() === declared.toLowerCase(),
      );

      if (!mapped) {
        issues.push(`unmapped variable: ${declared} in suboutput: ${step.name}`);
      }
    }

    // {{parentVar}} tokens must refer to parent's available variables (declared + read-produced)
    for (const value of Object.values(step.variables)) {
      const tokens = value.match(/\{\{(\w+)\}\}/g) ?? [];
      for (const token of tokens) {
        const varName = token.slice(2, -2);
        const declared = allParentVariables.find(
          v => v.toLowerCase() === varName.toLowerCase(),
        );

        if (!declared) {
          issues.push(`invalid reference: {{${varName}}} in suboutput: ${step.name}`);
        }
      }
    }

    // d. stepOverride keys must match step names in child's steps
    const childStepNames = new Set(subInstructions.steps.map(s => s.name));
    for (const overrideKey of Object.keys(step.stepOverride ?? {})) {
      if (!childStepNames.has(overrideKey)) {
        issues.push(`stepOverride target not found: ${overrideKey} in suboutput: ${step.name}`);
      }
    }

    // e. excludeSteps names must match step names in child's steps
    for (const excluded of step.excludeSteps ?? []) {
      if (!childStepNames.has(excluded)) {
        issues.push(`excludeSteps target not found: ${excluded} in suboutput: ${step.name}`);
      }
    }

    // f. Conflict: same step name in both excludeSteps and stepOverride
    const overrideNames = new Set(Object.keys(step.stepOverride ?? {}));
    const excludeNames = new Set(step.excludeSteps ?? []);
    for (const name of overrideNames) {
      if (excludeNames.has(name)) {
        issues.push(`conflict: "${name}" in both excludeSteps and stepOverride for suboutput: ${step.name}`);
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