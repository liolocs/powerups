import type { VariableResult } from "#utils/variables";
/**
 * Resolve {{var}} tokens in an outputPath string using the variables record.
 * Matching is case-insensitive: {{ComponentName}} matches key componentName.
 * Unresolved tokens are left as-is.
 */
export declare function resolveOutputPath(outputPath: string, variables: VariableResult): string;
//# sourceMappingURL=output-path.d.ts.map