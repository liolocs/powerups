import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import commands from "./cmd/index.js";


if (runtime.args.length === 0) {
  cli.prompt.intro("Welcome to Recipe cli !")
  cli.print("\n")

  cli.print(cli.bg.red(cli.fg.white(" ERROR ")), "No command specified.");
  cli.print("\n")
  cli.print("\n")
  cli.print("Available commands are:")
  cli.print("\n")
  commands.map(command => cli.print(` - ${command.name}\n`))
  runtime.exit(1);
}

runtime.exit(0);