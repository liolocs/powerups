import { type Command } from "@dryai/program";
import fs, { type FileInfo } from "@rcompat/fs";

const currentDir = import.meta.dirname;
const commandList = await fs.ref(currentDir)
  .files({
    filter: (file: FileInfo) =>
      file.name.includes("index.ts") === false,
  });

const commands: Command<any>[] = [];

for (const command of commandList) {
  const mod: Command<any> = await command.import("default");

  commands.push(mod);
}

export default commands;
