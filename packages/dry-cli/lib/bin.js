#!/usr/bin/env node
import CLI from "@dryai/program";
import commands from "./commands/index.js";
const program = new CLI({
    name: "dryai",
    description: "The best guardrails for ai output",
    version: "0.0.1",
    commands: commands,
});
try {
    await program.run();
}
catch (err) {
    console.error(err.message);
}
//# sourceMappingURL=bin.js.map