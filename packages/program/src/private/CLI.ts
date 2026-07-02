import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import type Command from "#Command";
import parseArgs from "#parseArgs";

export default class CLI {
  name: string;
  description: string;
  version: string;
  examples: string[];
  commands: Record<string, Command<any>>;

  constructor({
    name,
    description,
    version,
    commands,
    examples = [],
  }: {
    name: string;
    description: string;
    version: string;
    commands: Command<any>[];
    examples?: string[];
  }) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.examples = examples;
    this.commands = commands.reduce((acc, command) => {
      acc[command.name] = command;
      return acc;
    }, {} as Record<string, Command<any>>);
  }

  async run(args?: string[]): Promise<void> {
    const { flags, commands } = parseArgs(args ?? runtime.args);

    // Top-level flags only apply when no command is given. When a command is
    // present, everything (including -h / -v) delegates to that command so its
    // own short flags (e.g. `pattern gen -v`) are never shadowed.
    if (!is.defined(commands) || commands.length === 0) {
      if (flags.some(f => f.flag === "--version" || f.flag === "-v")) {
        cli.print(`${this.name} ${this.version}\n`);
        return;
      }

      this.showHelp();
      return;
    }

    const command = this.commands[commands[0]];

    if (is.defined(command) === false) {
      cli.print(`Unknown command: ${commands[0]}\n\n`);
      this.showHelp();
      return;
    }

    await command.run({ subcommands: commands.slice(1), flags });
  }

  showHelp(): void {
    const lines: string[] = [];

    // Header
    lines.push(`${this.name} — ${this.description}`);
    lines.push("");

    // Usage
    lines.push("USAGE");
    lines.push(`  ${this.name} <command> [subcommand] [flags]`);
    lines.push("");

    const all = Object.values(this.commands);
    const core = all.filter(command => command.subcommands.size === 0);
    const groups = all.filter(command => command.subcommands.size > 0);

    // Core commands (no subcommands)
    if (core.length > 0) {
      lines.push("CORE COMMANDS");
      const width = Math.max(...core.map(command => command.name.length));
      for (const command of core) {
        lines.push(`  ${command.name.padEnd(width + 2)}${command.description}`);
      }
      lines.push("");
    }

    // Grouped commands — each command with subcommands gets its own section,
    // titled "<NAME> COMMANDS", listing every "<group> <sub>" entry.
    for (const group of groups) {
      lines.push(`${group.name.toUpperCase()} COMMANDS`);
      const subs = [...group.subcommands.values()];
      const labels = subs.map(sub => `${group.name} ${sub.name}`);
      const width = Math.max(...labels.map(label => label.length));
      for (let i = 0; i < subs.length; i++) {
        lines.push(`  ${labels[i].padEnd(width + 2)}${subs[i].description}`);
      }
      lines.push("");
    }

    // Flags
    const flagEntries = [
      { label: "-h, --help", desc: "Show help for a command" },
      { label: "-v, --version", desc: `Show ${this.name} version` },
    ];
    const flagWidth = Math.max(...flagEntries.map(entry => entry.label.length));
    lines.push("FLAGS");
    for (const entry of flagEntries) {
      lines.push(`  ${entry.label.padEnd(flagWidth + 2)}${entry.desc}`);
    }
    lines.push("");

    // Examples
    if (this.examples.length > 0) {
      lines.push("EXAMPLES");
      for (const example of this.examples) {
        lines.push(`  ${example}`);
      }
      lines.push("");
    }

    // Footer
    lines.push(
      `Use "${this.name} <command> --help" for more information about a command.`,
    );

    cli.print(`${lines.join("\n")}\n`);
  }
}