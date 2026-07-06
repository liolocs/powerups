import type { VariableResult } from "#utils/variables";

/**
 * Resolve {{var}} tokens in a string using the variables record.
 * Matching is case-insensitive: {{ComponentName}} matches key componentName.
 * Unresolved tokens are left as-is.
 */
export function resolveTemplateString(
  str: string,
  variables: VariableResult,
): string {
  return str.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    const key = Object.keys(variables).find(
      k => k.toLowerCase() === token.toLowerCase(),
    );
    return key !== undefined ? variables[key] : match;
  });
}