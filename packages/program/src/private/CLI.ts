import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import Command from "#Command";
import parseArgs from "#parseArgs";

export default class CLI {
  name: string;
  description: string;
  version: string;
  commands: Record<string, Command<any>>;

  constructor({
    name,
    description,
    version,
    commands,
  }: {
    name: string;
    description: string;
    version: string;
    commands: Command<any>[];
  }) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.commands = commands.reduce((acc, command) => {
      acc[command.name] = command;
      return acc;
    }, {} as Record<string, Command<any>>);
  }

  run(args?: string[]): void {
    const { flags, commands } = parseArgs(args ?? runtime.args);

    if (is.defined(commands) === false) {
      this.showHelp();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if(this.commands[commands[0]] === undefined) {
      console.log("invalid command");
      this.showHelp();
      return;
    }

    const command = new Command(this.commands[commands[0]]!);

    command.run({subcommands: commands.slice(1), flags});
  }

  showHelp(): void {
    cli.print("Welcome to dryai!\n\n");
    cli.print(`Usage: ${this.name} <command>\n\n`);
    cli.print("Available Commands:\n");

    const commands = Object.values(this.commands);

    this._printOptions(commands);
  }

  private _printOptions(commands: Command<any>[]): void {
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