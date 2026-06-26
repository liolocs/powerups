import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import parseArgs from "#parseArgs";
export default class CLI {
    name;
    description;
    version;
    commands;
    constructor({ name, description, version, commands, }) {
        this.name = name;
        this.description = description;
        this.version = version;
        this.commands = commands.reduce((acc, command) => {
            acc[command.name] = command;
            return acc;
        }, {});
    }
    run(args) {
        const { flags, commands } = parseArgs(args ?? runtime.args);
        if (flags.some(f => f.flag === "--help" || f.flag === "-h")) {
            this.showHelp();
            return;
        }
        if (!is.defined(commands) || commands.length === 0) {
            this.showHelp();
            return;
        }
        const command = this.commands[commands[0]];
        if (is.defined(command) === false) {
            cli.print(`Unknown command: ${commands[0]}\n\n`);
            this.showHelp();
            return;
        }
        command.run({ subcommands: commands.slice(1), flags });
    }
    showHelp() {
        cli.print(`${this.name} — ${this.description}\n\n`);
        cli.print(`Usage: ${this.name} <command> [subcommand] [flags]\n\n`);
        cli.print("Commands:\n");
        for (const command of Object.values(this.commands)) {
            cli.print(`\n${command.buildHelp()}\n`);
        }
    }
}
//# sourceMappingURL=CLI.js.map