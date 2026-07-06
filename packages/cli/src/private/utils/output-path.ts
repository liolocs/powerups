import type { VariableResult } from "#utils/variables";
import { resolveTemplateString } from "#utils/resolve-template-string";

/**
 * Resolve {{var}} tokens in an outputPath string using the variables record.
 * Matching is case-insensitive: {{ComponentName}} matches key componentName.
 * Unresolved tokens are left as-is.
 */
export function resolveOutputPath(
  outputPath: string,
  variables: VariableResult,
): string {
  return resolveTemplateString(outputPath, variables);
}