import fs from "@rcompat/fs";
const currentDir = import.meta.dirname;
const parentDir = fs.ref(currentDir).up(1).name;
const isRunningWithTs = parentDir === "src";
const commandList = await fs.ref(currentDir)
    .files({
    filter: (file) => {
        if (isRunningWithTs) {
            return file.name.includes("index.ts") === false;
        }
        else {
            return !file.name.startsWith("index") && file.name.endsWith(".js");
        }
    },
});
const commands = [];
for (const command of commandList) {
    const mod = await command.import("default");
    commands.push(mod);
}
export default commands;
//# sourceMappingURL=index.js.map