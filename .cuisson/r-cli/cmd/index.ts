import fs from "@rcompat/fs";
import type { CommandDef } from "../lib/cli.js";

const currentDir = import.meta.dirname;
const commandList = await fs.ref(currentDir).files({ filter: file => !file.name.includes("index.ts")})

const commands: CommandDef[] = []

for (const command of commandList) {
  const name = command.name.split(".")[0];
  const mod = await command.import<CommandDef>("default");

  // Each command file exports a CommandDef with name, description, flags, and action
  commands.push({
    name,
    ...mod,
  });
}

export default commands;
