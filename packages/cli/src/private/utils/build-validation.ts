import type { FileRef } from "@rcompat/fs";
import type { Instructions, Step } from "@liolocs/powerups-sdk";

export interface BuildValidationContext {
  /** The powerup's own dist/ folder — used to verify own templates exist. */
  outputFolder: FileRef;
}

const TOKEN = /\{\{(\w+)\}\}/g;

function templateOf(step: Step): string | undefined {
  return (step as Step & { template?: string }).template;
}

function pathOf(step: Step): string | undefined {
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

/**
 * Build-time validation replacing the deleted runtime checkOutput.
 * Returns a list of issue strings (empty = valid).
 */
export async function validateInstructions(
  instructions: Instructions,
  ctx: BuildValidationContext,
): Promise<string[]> {
  const issues: string[] = [];
  const required = instructions.variables.required;
  const optional = instructions.variables.optional ?? [];
  const declared = new Set<string>([
    ...required.map(r => r.toLowerCase()),
    ...optional.map(o => o.toLowerCase()),
  ]);

  // unique step names
  const seen = new Set<string>();
  for (const step of instructions.steps) {
    if (seen.has(step.name)) {
      issues.push(`duplicate step name: ${step.name}`);
    }
    seen.add(step.name);
  }

  // variable availability (read-produced vars accumulate in order)
  const available = new Set<string>(declared);
  for (const step of instructions.steps) {
    const p = pathOf(step);
    const keys = mapKeys(step);
    if (p) {
      for (const [, token] of p.matchAll(TOKEN)) {
        if (!available.has(token.toLowerCase()) && !keys.has(token)) {
          issues.push(`step "${step.name}" uses {{${token}}} before it is available`);
        }
      }
    }
    if (step.type === "read") {
      available.add(step.as.toLowerCase());
    }
  }

  return issues;
}