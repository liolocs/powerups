import fs, { type FileRef } from "@rcompat/fs";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { validateOutputTree } from "#utils/validate-output";

/**
 * Full output validation: schema conformance, template file existence,
 * variable ordering, step name uniqueness, and suboutput tree integrity.
 * Returns a list of issue strings (empty = valid). Never throws on a
 * validation failure.
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
    issues.push(error_ instanceof Error ? error_.message : String(error_));
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
  for (const step of instructions.steps) {
    if (step.type === "create" || step.type === "modify" || step.type === "delete") {
      for (const [, token] of step.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
        pathVariables.add(token);
      }
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

  // c) Template file existence for create, modify, and read (template mode)
  for (const step of instructions.steps) {
    if (step.type === "create" || step.type === "modify") {
      const templatePath = currentOutputDir.append(`/${step.template}`);
      if (!(await fs.exists(templatePath))) {
        issues.push(`missing template file: ${step.template}`);
      }
    }
    if (step.type === "read" && step.template) {
      const templatePath = currentOutputDir.append(`/${step.template}`);
      if (!(await fs.exists(templatePath))) {
        issues.push(`missing template file: ${step.template}`);
      }
    }
  }

  // d) Step name uniqueness
  const seenNames = new Set<string>();
  for (const step of instructions.steps) {
    if (seenNames.has(step.name)) {
      issues.push(`duplicate step name: ${step.name}`);
    }
    seenNames.add(step.name);
  }

  // e) Variable ordering validation
  const available = new Set<string>([
    ...required.map(r => r.toLowerCase()),
    ...optional.map(o => o.toLowerCase()),
  ]);

  for (const step of instructions.steps) {
    const tokens = new Map<string, string>();

    if (step.type === "create" || step.type === "modify" || step.type === "delete") {
      for (const [, token] of step.outputPath.matchAll(/\{\{(\w+)\}\}/g)) {
        tokens.set(token.toLowerCase(), token);
      }
    } else if (step.type === "read") {
      for (const [, token] of step.path.matchAll(/\{\{(\w+)\}\}/g)) {
        tokens.set(token.toLowerCase(), token);
      }
    } else if (step.type === "include") {
      for (const value of Object.values(step.variables)) {
        for (const [, token] of value.matchAll(/\{\{(\w+)\}\}/g)) {
          tokens.set(token.toLowerCase(), token);
        }
      }
    }

    for (const [lower, original] of tokens) {
      if (!available.has(lower)) {
        issues.push(`step "${step.name}" uses {{${original}}} before it is available`);
      }
    }

    if (step.type === "read") {
      available.add(step.as.toLowerCase());
    }
  }

  // f) Read `as` collision with declared variables
  for (const step of instructions.steps) {
    if (step.type === "read") {
      const allDeclared = [...required, ...optional];
      if (allDeclared.some(v => v.toLowerCase() === step.as.toLowerCase())) {
        issues.push(`read step "${step.name}" produces variable "${step.as}" which shadows a declared variable`);
      }
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