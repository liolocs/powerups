import type { CommandType } from "#Command";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import Command from "#Command";

export default class CLI {
  name: string;
  description: string;
  version: string;
  commands: Record<string, CommandType>;

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
    this.commands = commands.reduce((acc, command) => {
      acc[command.name] = command;
      return acc;
    }, {} as Record<string, CommandType>);
  }

  run(args?: string[]): void {
    const [commandName, ...restArgs] = args ?? runtime.args;

    if (is.defined(commandName) === false) {
      this.showHelp();
      return;
    }

    const command = new Command(this.commands[commandName]);

    if (restArgs.length === 0) {
      cli.print(
        cli.bg.red(cli.fg.white(" ERROR ")),
        "Missing required arguments for the ",
        `${cli.bg.yellow(" "+commandName+" ")} command.\n`,
      );
      cli.print("\n");

      this.showSubCommandHelp(command);
    }

    command.run(restArgs);
  }

  showSubCommandHelp(command: CommandType): void {
    cli.print(`Usage: ${this.name} ${command.name} <subcommand>\n\n`);
    cli.print(`${is.defined(command.description)
      ? command.description : ""}
    \n`);
    cli.print("Available Subcommands:\n");

    this._printOptions(command.subcommands!);
  }

  showHelp(): void {
    cli.print("Welcome to dryai!\n\n");
    cli.print(`Usage: ${this.name} <command>\n\n`);
    cli.print("Available Commands:\n");

    const commands = Object.values(this.commands);

    this._printOptions(commands);
  }

  private _printOptions(commands: CommandType[]): void {
    for (const command of commands) {
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