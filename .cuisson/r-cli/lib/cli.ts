import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";

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

function parseFlags(
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

export class CommandBuilder {
  private _name = "";
  private _description = "";
  private _action?: (args: string[], flags: Record<string, unknown>) => Promise<void> | void;
  private _subcommands: CommandDef[] = [];
  private _flags: FlagDefinition[] = [];

  name(n: string): this {
    this._name = n;
    return this;
  }

  description(d: string): this {
    this._description = d;
    return this;
  }

  action(
    fn: (args: string[], flags: Record<string, unknown>) => Promise<void> | void
  ): this {
    this._action = fn;
    return this;
  }

  option(flags: string, desc?: string): this {
    // Parse shorthand like "-v, --var <value>" or "--var <value>" or "-v"
    const parts = flags.split(",").map(s => s.trim());
    const shortPart = parts[0].trim();
    const longPart = (parts[1] || parts[0]).trim();

    let short: string | undefined;
    let long = longPart;
    let valueFlag = false;

    if (shortPart.startsWith("-") && !shortPart.startsWith("--")) {
      short = shortPart;
    }

    // Extract value placeholder: --var <value> or -v <value>
    const valueMatch = long.match(/^--(\S+)\s+<(.+)>$/);
    if (valueMatch) {
      long = `--${valueMatch[1]}`;
      valueFlag = true;
    } else {
      const shortValueMatch = long.match(/^-([a-zA-Z])\s+<(.+)>$/);
      if (shortValueMatch) {
        short = `-${shortValueMatch[1]}`;
        long = `--${shortValueMatch[1]}`;
        valueFlag = true;
      }
    }

    // Detect array: --var ... or <value...>
    const isArray = long.includes("...") || (desc && desc.includes("repeatable"));
    if (isArray) {
      long = long.replace(/\s*\.\.\./, "");
    }

    this._flags.push({ short, long: long.replace(/^--?/, (m) => `--`), value: !valueFlag, array: isArray });
    if (desc) {
      // Store description via a side-channel — not used in parsing but available for help
    }

    return this;
  }

  subcommand(name: string): CommandBuilder {
    const child = new CommandBuilder();
    child._name = name;
    this._subcommands.push(child.build());
    return child;
  }

  build(): CommandDef {
    return {
      name: this._name,
      description: this._description,
      action: this._action,
      subcommands: this._subcommands.length > 0 ? this._subcommands : undefined,
      flags: this._flags.length > 0 ? this._flags : undefined,
    };
  }
}

export class Commander {
  private commands: Map<string, CommandDef> = new Map();
  private _name = "recipe";
  private _version = "";

  constructor(name?: string) {
    if (name) this._name = name;
  }

  name(n: string): this {
    this._name = n;
    return this;
  }

  version(v: string): this {
    this._version = v;
    return this;
  }

  register(cmd: CommandDef): this {
    this.commands.set(cmd.name, cmd);
    return this;
  }

  registerAll(cmds: CommandDef[]): this {
    for (const cmd of cmds) {
      this.register(cmd);
    }
    return this;
  }

  command(name: string): CommandBuilder {
    const builder = new CommandBuilder();
    builder._name = name;
    return builder;
  }

  parse(args?: string[]): void {
    const argv = args ?? runtime.args; // runtime.args is already pre-sliced (Bun.argv.slice(2))

    if (argv.length === 0) {
      this.showHelpAndError();
      return;
    }

    const commandName = argv[0];
    const cmd = this.commands.get(commandName);

    if (!cmd) {
      cli.print(
        cli.bg.red(cli.fg.white(" ERROR ")),
        `Unknown command "${commandName}".`
      );
      cli.print("\n");
      this.showAvailableCommands();
      runtime.exit(1);
      return; // unreachable, but TS needs it
    }

    const remainingArgs = argv.slice(1);

    // Check if this is a subcommand group (has registered subcommands)
    const hasRegisteredSubcommands = cmd.subcommands && cmd.subcommands.length > 0;

    if (hasRegisteredSubcommands && remainingArgs.length === 0) {
      // Group with no subcommand specified — show help
      cli.print(`Usage: ${this._name} ${cmd.name} <subcommand>\n\n`);
      cli.print(`${cmd.description || ""}\n\n`);
      cli.print("Subcommands:\n");
      for (const sub of cmd.subcommands!) {
        cli.print(`  ${sub.name.padEnd(20)} ${sub.description || ""}\n`);
      }
      runtime.exit(1);
      return;
    }

    // Check for subcommand in registered subcommands
    if (hasRegisteredSubcommands && remainingArgs.length > 0) {
      const subName = remainingArgs[0];
      const subCmd = cmd.subcommands!.find(s => s.name === subName);

      if (!subCmd) {
        cli.print(
          cli.bg.red(cli.fg.white(" ERROR ")),
          `Unknown subcommand "${subName}".`
        );
        cli.print("\n");
        this.showAvailableCommands();
        runtime.exit(1);
        return;
      }

      // Parse flags for subcommand and dispatch
      try {
        const parsed = parseFlags(remainingArgs.slice(1), subCmd.flags || []);
        void (async () => {
          await subCmd.action?.(parsed.positional, parsed.values);
        })();
      } catch (err) {
        cli.print(
          cli.bg.red(cli.fg.white(" ERROR ")),
          ` ${err instanceof Error ? err.message : String(err)}\n`
        );
        runtime.exit(1);
      }
      return;
    }

    // Regular command — parse flags and dispatch
    try {
      const parsed = parseFlags(remainingArgs, cmd.flags || []);
      void (async () => {
        await cmd.action?.(parsed.positional, parsed.values);
      })();
    } catch (err) {
      cli.print(
        cli.bg.red(cli.fg.white(" ERROR ")),
        ` ${err instanceof Error ? err.message : String(err)}\n`
      );
      runtime.exit(1);
    }
  }

  private showHelpAndError(): void {
    cli.prompt.intro(`Welcome to ${this._name}!`);
    cli.print("\n");

    cli.print(
      cli.bg.red(cli.fg.white(" ERROR ")),
      " No command specified.\n"
    );
    cli.print("\n");

    this.showAvailableCommands();
    runtime.exit(1);
  }

  private showAvailableCommands(): void {
    cli.print("Available commands:\n");
    for (const [name, cmd] of this.commands) {
      const desc = cmd.description || "";
      cli.print(`  ${name.padEnd(20)} ${desc}\n`);
    }
  }

  // Get registered command names (for help display)
  getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }

  // Get a command by name (for introspection)
  getCommand(name: string): CommandDef | undefined {
    return this.commands.get(name);
  }
}

const cliFramework = new Commander("recipe");
export default cliFramework;
