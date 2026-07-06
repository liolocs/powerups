import { type Command } from "@saved/program";
import fs, { type FileInfo } from "@rcompat/fs";

const currentDir = import.meta.dirname;
const parentDir = fs.ref(currentDir).up(1).name;

const isRunningWithTs = parentDir === "src";
const commandList = await fs.ref(currentDir)
  .files({
    filter: (file: FileInfo) => {
      if (isRunningWithTs) {
        return file.name.includes("index.ts") === false;
      } else {
        return !file.name.startsWith("index") && file.name.endsWith(".js");
      }
    },
  });

const commands: Command<any>[] = [];

for (const command of commandList) {
  const mod: Command<any> = await command.import("default");

  commands.push(mod);
}

export default commands;
