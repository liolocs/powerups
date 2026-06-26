#!/usr/bin/env node
import CLI from "@dryai/program";
import { type TemplateError } from "@rcompat/error"
import commands from "./commands/index.js";

const program = new CLI({
  name: "dryai",
  description: "The best guardrails for ai output",
  version: "0.0.1",
  commands: commands,
});

try {
  program.run();
} catch (err) {
  console.error((err as TemplateError).message);
}