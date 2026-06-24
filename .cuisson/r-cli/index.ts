import cli from "./lib/cli/cli.js";
import runtime from "@rcompat/runtime";
import commands from "./cmd/index.js";

cli.registerAll(commands);

// Parse CLI args and dispatch to the correct command handler
cli.parse();
