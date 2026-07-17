#!/usr/bin/env node
import CLI from "@powers/program";
import { type TemplateError } from "@rcompat/error";
import commands from "./commands/index.js";
import { CLI_CMD } from "#constants";

const program = new CLI({
  name: CLI_CMD,
  description: "The best guardrails for AI output",
  version: "0.0.1",
  commands: commands,
  examples: [
    `$ ${CLI_CMD} init`,
    `$ ${CLI_CMD} init --harness=claude`,
    `$ ${CLI_CMD} update`,
    `$ ${CLI_CMD} update --harness=claude`,
    `$ ${CLI_CMD} template create my-template`,
    `$ ${CLI_CMD} template apply my-template --var name=foo`,
    `$ ${CLI_CMD} feature search "summarize a pdf"`,
    `$ ${CLI_CMD} doctor`,
  ],
});

try {
  await program.run();
} catch (err) {
  console.error("\n" + (err as TemplateError).message);
}