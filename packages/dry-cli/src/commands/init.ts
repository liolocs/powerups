import {Command} from "@dryai/program";

const init = new Command({
  name: "init",
  description: "Initialize a dryai project",
  flags: [],
  subcommands: [],
  action: () => {
    console.log("init");
  },
});

export default init;