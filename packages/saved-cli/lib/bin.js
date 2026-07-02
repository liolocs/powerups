#!/usr/bin/env node
import CLI from "@dryai/program";
import commands from "./commands/index.js";
import { CLI_NAME } from "#constants";
const program = new CLI({
    name: CLI_NAME,
    description: "The best guardrails for AI output",
    version: "0.0.1",
    commands: commands,
    examples: [
        `$ ${CLI_NAME} init`,
        `$ ${CLI_NAME} pattern gen my-pattern`,
        `$ ${CLI_NAME} pattern run my-pattern --var name=foo`,
        `$ ${CLI_NAME} pattern search "summarize a pdf"`,
    ],
});
try {
    await program.run();
}
catch (err) {
    console.error(err.message);
}
//# sourceMappingURL=bin.js.map