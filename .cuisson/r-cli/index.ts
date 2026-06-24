import cli from "./lib/cli.js";
import runtime from "@rcompat/runtime";
import commands from "./cmd/index.js";

// Register all discovered commands
cli.registerAll(commands);

// Parse CLI args and dispatch to the correct command handler
cli.parse();
