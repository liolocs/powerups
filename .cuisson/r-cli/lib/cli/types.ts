export interface FlagDefinition {
  short?: string;   // e.g. "-v"
  long: string;     // e.g. "--var"
  value?: boolean;  // flag without value (boolean switch)
  array?: boolean;  // can be repeated (--var a --var b)
  required?: boolean;
  default?: unknown;
}

export interface CommandDef {
  name: string;
  description?: string;
  action?: (args: string[], flags: Record<string, unknown>) => Promise<void> | void;
  subcommands?: CommandDef[];
  flags?: FlagDefinition[];
}

export interface ParsedFlags {
  values: Record<string, unknown>;
  positional: string[];
}