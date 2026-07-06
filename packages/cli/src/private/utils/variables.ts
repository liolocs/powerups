import patternRunErrors from "#errors/patternRunErrors";

export interface VariableResult {
  [key: string]: string;
}

/**
 * Convert a CLI flag string to camelCase variable name.
 * "--component-name" -> "componentName"
 * "--theme" -> "theme"
 * "-d" -> "d"
 */
export function normalizeFlagName(flag: string): string {
  // Strip leading -- or -
  const stripped = flag.replace(/^--?/, "");
  // Split on hyphens
  const parts = stripped.split("-");
  // First part stays lowercase, rest get capitalized first letter
  return parts[0] +
    parts.slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
}

/**
 * Convert a variable name (any case) to kebab-case for flag hints.
 * "ComponentName" -> "component-name"
 * "theme" -> "theme"
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "-$1")
    .replace(/^-/, "")
    .toLowerCase();
}

/**
 * Extract variables from raw CLI flags, normalize to camelCase,
 * and validate against declared variables (case-insensitive).
 *
 * Undeclared extra flags are passed through in the result (not filtered out).
 */
export function extractVariables(
  rawFlags: { flag: string; value: string }[],
  declaredVariables: string[],
  excludeFlags: string[],
): VariableResult {
  // 1. Filter out excluded flags (--dry-run, -d, --help, -h)
  const variableFlags = rawFlags.filter(
    f => !excludeFlags.includes(f.flag),
  );

  // 2. Build camelCase key/value record
  const result: VariableResult = {};
  for (const f of variableFlags) {
    const key = normalizeFlagName(f.flag);
    result[key] = f.value;
  }

  // 3. Validate: each declared variable must have a matching flag
  //    Match case-insensitively: componentName satisfies ComponentName
  for (const declared of declaredVariables) {
    const matched = Object.keys(result).find(
      k => k.toLowerCase() === declared.toLowerCase(),
    );
    if (!matched) {
      throw patternRunErrors.missing_variable(
        declared,
        toKebabCase(declared),
      );
    }
  }

  return result;
}