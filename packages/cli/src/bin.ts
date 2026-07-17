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
    `$ ${CLI_CMD} gain`,
    `$ ${CLI_CMD} gain --harness=claude`,
    `$ ${CLI_CMD} update`,
    `$ ${CLI_CMD} search -q="summarize a pdf"`,
    `$ ${CLI_CMD} info my-power`,
    `$ ${CLI_CMD} use my-power --var name=foo`,
    `$ ${CLI_CMD} doctor`,
  ],
});

try {
  await program.run();
} catch (err) {
  console.error("\n" + (err as TemplateError).message);
}