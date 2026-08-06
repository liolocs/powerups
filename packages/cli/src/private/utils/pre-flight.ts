import fs, { type FileRef } from "@rcompat/fs";
import type { Instructions, Step } from "@liolocs/powerups-sdk";
import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";
import use_errors from "#errors/useErrors";

export interface PreFlightArgs {
  instructions: Instructions;
  outputFolder: FileRef;
  rootDir: FileRef;
  variables: VariableResult;
  isOverwrite: boolean;
}

function templateOf(step: Step): string | undefined {
  return (step as Step & { template?: string }).template;
}

function outputPathOf(step: Step): string | undefined {
  if (step.type === "create" || step.type === "modify" || step.type === "delete") {
    return step.outputPath;
  }
  if (step.type === "read") {
    return step.path;
  }
  return undefined;
}

function mapKeys(step: Step): Set<string> {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  return new Set(map ? Object.keys(map) : []);
}

export function stepVars(step: Step, variables: VariableResult): VariableResult {
  const map = (step as Step & { variableMap?: Record<string, string> }).variableMap;
  if (!map) return variables;
  const v: VariableResult = { ...variables };
  for (const [k, val] of Object.entries(map)) {
    v[k] = resolveTemplateString(val, v);
  }
  return v;
}

/**
 * Validate before writing anything: templates exist, create destinations don't
 * collide (unless --overwrite). Collision checks for paths that still contain
 * unresolved {{tokens}} (read-produced variables) are deferred to execution.
 */
export async function preFlight(args: PreFlightArgs): Promise<void> {
  const { instructions, outputFolder, rootDir, variables, isOverwrite } = args;
  const issues: string[] = [];

  for (const step of instructions.steps) {
    // template existence (own + _internal)
    const tmpl = templateOf(step);
    if (tmpl) {
      const ref = outputFolder.append(`/${tmpl}`);
      if (!(await fs.exists(ref))) {
        issues.push(`missing template file: ${tmpl}`);
      }
    }

    // create collisions (create only — modify/delete targets existing by design)
    if (step.type === "create") {
      const v = stepVars(step, variables);
      const resolved = resolveTemplateString(step.outputPath, v);
      if (!resolved.includes("{{")) {
        const target = rootDir.append(`/${resolved}`);
        if (await fs.exists(target)) {
          if (!isOverwrite) {
            issues.push(`destination exists: ${resolved}`);
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    throw use_errors.invalid_composition(issues);
  }
}