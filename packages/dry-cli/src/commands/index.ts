import fs, { type FileInfo } from "@rcompat/fs";
import cli from "@rcompat/cli";

const currentDir = import.meta.dirname;
const commandList = await fs.ref(currentDir)
  .files({
    filter: (file: FileInfo) =>
      file.name.includes("index.ts") === false,
  });

const commands: Record<string, unknown> = {};

for (const command of commandList) {
  const mod = await command.import("default");

  commands[command.name] = mod;
}

// function unknown(command: string) {
//   return () => {
//     cli.print(`Unknown command ${cli.fg.dim(command)}\n`);
//   };
// };

// function in_commands(command: string): command is keyof typeof commands {
//   return Object.keys(commands).find(key =>
//     key === command || key.startsWith(command)) !== undefined;
// }

// export default function run_command(command_flag: string = "") {
//   const [command, action = ""] = command_flag.trim().split(":");
//   if (command === "") return "run dev";

//   if (in_commands(command)) {
//     if (action === "") return commands[command];
//     else {
//       const subcommand = `${command}_${action}`;
//       if (in_commands(subcommand)) return commands[subcommand];
//       return unknown(subcommand.replace("_", ":"));
//     }
//   }
//   return unknown(command);
// };

