import is from "@rcompat/is";

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
 * Required variables must be provided; if any are missing, `onMissing`
 * is called once with the full list of missing variable names.
 *
 * Optional variables default to empty string when not provided.
 *
 * Undeclared extra flags are passed through in the result (not filtered out).
 */
export function extractVariables(args: {
  rawFlags: { flag: string; value: string }[];
  required: string[];
  optional: string[];
  excludeFlags: string[];
  defaults?: Record<string, string>;
  onMissing: (missing: string[]) => never;
}): VariableResult {
  const { rawFlags, required, optional, excludeFlags, defaults, onMissing } = args;

  // 1. Filter out excluded flags (--dry-run, -d, --overwrite, -O, --help, -h)
  const variableFlags = rawFlags.filter(
    f => !excludeFlags.includes(f.flag),
  );

  // 2. Build camelCase key/value record
  const result: VariableResult = {};
  for (const f of variableFlags) {
    const key = normalizeFlagName(f.flag);
    result[key] = f.value;
  }

  // 3. Validate required: collect ALL missing, then call onMissing once
  const missing: string[] = [];
  for (const declared of required) {
    const matched = Object.keys(result).find(
      k => k.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      missing.push(declared);
    }
  }
  if (missing.length > 0) {
    onMissing(missing);
  }

  // 4. Optional: if provided, use the value; if not, use a declared default or ""
  for (const declared of optional) {
    const matched = Object.keys(result).find(
      k => k.toLowerCase() === declared.toLowerCase(),
    );
    if (is.falsy(matched)) {
      result[declared] = defaults?.[declared] ?? "";
    }
  }

  return result;
}