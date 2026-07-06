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
    `$ ${CLI_NAME} output gen my-output`,
    `$ ${CLI_NAME} output run my-output --var name=foo`,
    `$ ${CLI_NAME} output search "summarize a pdf"`,
  ],
});

try {
  await program.run();
} catch (err) {
  console.error((err as TemplateError).message);
}