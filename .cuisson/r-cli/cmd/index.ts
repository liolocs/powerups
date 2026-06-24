import fs from "@rcompat/fs";
import type { CommandDef } from "../lib/cli/types.js";

const currentDir = import.meta.dirname;
const commandList = await fs.ref(currentDir).files({ filter: file => !file.name.includes("index.ts")})

const commands: CommandDef[] = []

for (const command of commandList) {
  const mod: CommandDef = await command.import("default");

  commands.push(mod);
}

export default commands;
