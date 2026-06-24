import type { CommandType } from "#Command";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";

export default class CLI {
  name: string;
  description: string;
  version: string;
  commands: CommandType[];

  constructor({
    name,
    description,
    version,
    commands,
  }: {
    name: string;
    description: string;
    version: string;
    commands: CommandType[];
  }) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.commands = commands;
  }

  run(args?: string[]): void {
    const argv = args ?? runtime.args;
    const flags = runtime.flags;

    console.log({ argv });
    console.log({ flags });

    if (argv.length === 0) {
      this.showHelp();
      return;
    }
  }

  showHelp(): void {
    cli.print("Welcome to dryai!\n\n");
    cli.print(`Usage: ${this.name} <command>\n\n`);
    cli.print("Available Commands:\n");

    for (const command of this.commands) {
      cli.print(`  ${command.name.padEnd(20)} ${command.description}\n`);
      cli.print("\n");
      cli.print("Options:\n");

      for (const flag of command.flags) {
        const short = is.defined(flag.short) ? `-${flag.short}` : "";
        const long = is.defined(flag.long) ? `--${flag.long}` : "";
        const shortAndLong = [short, long].filter(Boolean).join(", ");

        cli.print(`  ${shortAndLong.padEnd(20)} ${flag.description}\n`);
        cli.print("\n");
      }
    }
  }
}