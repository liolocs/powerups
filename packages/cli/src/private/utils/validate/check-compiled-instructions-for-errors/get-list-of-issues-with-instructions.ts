import type { FileRef } from "@rcompat/fs";
import type { Instructions, Step } from "@liolocs/powerups-sdk";
import is from "@rcompat/is";

export interface BuildValidationContext {
  /** The powerup's own dist/ folder — used to verify own templates exist. */
  outputFolder: FileRef;
}

const TOKEN = /\{\{(\w+)\}\}/g;

function pathOf(step: Step): string | undefined {
  if (step.type === "create" ||
    step.type === "modify" ||
    step.type === "delete"
  ) {
    return step.outputPath;
  }
  if (step.type === "read") {
    return step.path;
  }
  return undefined;
}

function getVariableMap(step: Step): Record<string, string> | undefined {
  return (step as Step & { variableMap?: Record<string, string> }).variableMap;
}

function mapKeys(step: Step): Set<string> {
  const map = getVariableMap(step);
  return new Set(is.truthy(map) ? Object.keys(map!) : []);
}

function mapValues(step: Step): string[] {
  const map = getVariableMap(step);
  return is.truthy(map) ? Object.values(map!) : [];
}

export const instruction_errors = {
  duplicate_step_name: (name: string) => `[ERROR] duplicate step name: ${name}`,
  uses_template_variable_before_it_is_available: (name: string, templateVariable: string) =>
    `[ERROR] step "${name}" uses {{${templateVariable}}} before it is available`,
};

/**
 * Returns a list of issue strings (empty = valid).
 */
export async function getListOfIssuesWithInstructions(
  instructions: Instructions,
): Promise<string[]> {
  const issues: string[] = [];
  const required = instructions.variables.required;
  const optional = instructions.variables.optional ?? [];
  const declared = new Set<string>([
    ...required.map(r => r.toLowerCase()),
    ...optional.map(o => o.toLowerCase()),
  ]);


  // TODO should sanitise dependencies from install steps

  // unique step names
  const seen = new Set<string>();
  for (const step of instructions.steps) {
    if (seen.has(step.name)) {
      issues.push(instruction_errors.duplicate_step_name(step.name));
    }
    seen.add(step.name);
  }

  const availableVariables = new Set<string>(declared);

  for (const step of instructions.steps) {
    const stepPath = pathOf(step);
    const keys = mapKeys(step);

    if (is.truthy(stepPath)) {
      for (const [, templateVariable] of stepPath!.matchAll(TOKEN)) {
        const usesTemplateVariableBeforeItIsAvailable =
          !availableVariables.has(templateVariable.toLowerCase())
          && !keys.has(templateVariable);

        if (usesTemplateVariableBeforeItIsAvailable) {
          issues.push(instruction_errors.uses_template_variable_before_it_is_available(step.name, templateVariable));
        }
      }
    }

    for (const value of mapValues(step)) {
      for (const [, templateVariable] of value.matchAll(TOKEN)) {
        const isNotInAvailableVariables = !availableVariables.has(templateVariable.toLowerCase());

        if (isNotInAvailableVariables) {
          issues.push(instruction_errors.uses_template_variable_before_it_is_available(step.name, templateVariable));
        }
      }
    }

    if (step.type === "read") {
      availableVariables.add(step.as.toLowerCase());
    }
  }

  return issues;
}