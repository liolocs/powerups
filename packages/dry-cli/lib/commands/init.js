import { Command } from "@dryai/program";
const init = new Command({
    name: "init",
    description: "Initialize a dryai project",
    flags: [],
    subcommands: [],
    action: () => {
        console.log("init");
        // look for the .dry folder
        // if it exists, abort
        // create the .dry folder if missing
    },
});
export default init;
//# sourceMappingURL=init.js.map