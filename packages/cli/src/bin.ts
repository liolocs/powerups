#!/usr/bin/env node
import CLI from "@saved/program";
import { type TemplateError } from "@rcompat/error";
import commands from "./commands/index.js";
import { CLI_NAME } from "#constants";

const program = new CLI({
  name: CLI_NAME,
  description: "The best guardrails for AI output",
  version: "0.0.1",
  commands: commands,
  examples: [
    `$ ${CLI_NAME} init`,
    `$ ${CLI_NAME} init --harness=claude`,
    `$ ${CLI_NAME} template create my-template`,
    `$ ${CLI_NAME} template apply my-template --var name=foo`,
    `$ ${CLI_NAME} feature search "summarize a pdf"`,
    `$ ${CLI_NAME} doctor`,
  ],
});

try {
  await program.run();
} catch (err) {
  console.error((err as TemplateError).message);
}