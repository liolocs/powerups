export interface VariableResult {
    [key: string]: string;
}
/**
 * Convert a CLI flag string to camelCase variable name.
 * "--component-name" -> "componentName"
 * "--theme" -> "theme"
 * "-d" -> "d"
 */
export declare function normalizeFlagName(flag: string): string;
/**
 * Convert a variable name (any case) to kebab-case for flag hints.
 * "ComponentName" -> "component-name"
 * "theme" -> "theme"
 */
export declare function toKebabCase(name: string): string;
/**
 * Extract variables from raw CLI flags, normalize to camelCase,
 * and validate against declared variables (case-insensitive).
 *
 * Undeclared extra flags are passed through in the result (not filtered out).
 */
export declare function extractVariables(rawFlags: {
    flag: string;
    value: string;
}[], declaredVariables: string[], excludeFlags: string[]): VariableResult;
//# sourceMappingURL=variables.d.ts.map