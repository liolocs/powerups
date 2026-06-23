import fs from "@rcompat/fs"

const currentDir = import.meta.dirname;
const commandList = await fs.ref(currentDir).files({ filter: file => !file.name.includes("index.ts")})

const commands = []

for (const command of commandList) {
  commands.push({
    name: command.name.split(".")[0],
    import: await command.import("default")
  })
}

export default commands