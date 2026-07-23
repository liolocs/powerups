#!/usr/bin/env node
import CLI from "@powerups/program";
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
    `$ ${CLI_CMD} init claude`,
    `$ ${CLI_CMD} project init`,
    `$ ${CLI_CMD} install npm:my-package`,
    `$ ${CLI_CMD} install npm:my-package -l`,
    `$ ${CLI_CMD} update`,
    `$ ${CLI_CMD} pack create my-package`,
    `$ ${CLI_CMD} create --pack=my-package -t=multi-use -n=my-power -d="..."`,
    `$ ${CLI_CMD} pack move my-package global`,
    `$ ${CLI_CMD} find -q="summarize a pdf"`,
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