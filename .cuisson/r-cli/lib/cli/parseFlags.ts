import type { FlagDefinition, ParsedFlags } from "./types.ts";

export function parseFlags(
  args: string[],
  definitions: FlagDefinition[]
): ParsedFlags {
  const values: Record<string, unknown> = {};
  const positional: string[] = [];

  // Initialize defaults
  for (const def of definitions) {
    const key = def.long.replace(/^--?/, "");
    if (def.default !== undefined) {
      values[key] = def.array ? [...(def.default as unknown[])] : def.default;
    } else if (def.array) {
      values[key] = [];
    } else if (!def.value) {
      values[key] = undefined;
    }
  }

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      // Long flag: --key or --key=value
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        const def = definitions.find(d => d.long === `--${key}` || d.short === `-${key}`);
        if (def) {
          const flagKey = def.long.replace(/^--?/, "");
          if (def.array) {
            values[flagKey] = [...(values[flagKey] as unknown[]), value];
          } else {
            values[flagKey] = value;
          }
        } else {
          // Unknown flag — store as positional for subcommand parsing
          positional.push(arg);
        }
      } else {
        const key = arg.slice(2);
        const def = definitions.find(d => d.long === `--${key}` || d.short === `-${key}`);
        if (def) {
          const flagKey = def.long.replace(/^--?/, "");
          if (def.value) {
            values[flagKey] = true;
          } else {
            // Next arg is the value
            if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
              i++;
              if (def.array) {
                values[flagKey] = [...(values[flagKey] as unknown[]), args[i]];
              } else {
                values[flagKey] = args[i];
              }
            }
          }
        } else {
          positional.push(arg);
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag: -v
      const short = arg;
      const key = arg.slice(1);
      const def = definitions.find(d => d.short === short || d.long === `--${key}`);
      if (def) {
        const flagKey = def.long.replace(/^--?/, "");
        if (def.value) {
          values[flagKey] = true;
        } else {
          if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
            i++;
            if (def.array) {
              values[flagKey] = [...(values[flagKey] as unknown[]), args[i]];
            } else {
              values[flagKey] = args[i];
            }
          }
        }
      } else {
        positional.push(arg);
      }
    } else {
      // Positional argument
      positional.push(arg);
    }

    i++;
  }

  // Validate required flags
  for (const def of definitions) {
    if (def.required && !values[def.long.replace(/^--?/, "")]) {
      throw new Error(`Missing required flag: ${def.long}`);
    }
  }

  return { values, positional };
}