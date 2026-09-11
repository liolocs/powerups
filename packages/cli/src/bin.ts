#!/usr/bin/env node
import CLI from "@liolocs/program";
import commands from "./commands/index.js";
import { CLI_CMD } from "#constants";
import getErrorMessage from "./private/errors/get-error-message.js";

const program = new CLI({
  name: CLI_CMD,
  description: "The best guardrails for AI output",
  version: "0.0.1",
  commands: commands,
  examples: [
    `$ ${CLI_CMD} install npm:my-package`,
    `$ ${CLI_CMD} install npm:my-package -l`,
    `$ ${CLI_CMD} install git:<source>`,
    `$ ${CLI_CMD} install git:<source> -l`,
    `$ ${CLI_CMD} create <powerup-name>`,
    `$ ${CLI_CMD} create <powerup-name> --capture=all`,
    `$ ${CLI_CMD} create <powerup-name> --capture=workingDir`,
    `$ ${CLI_CMD} use <powerup-name> --var name=foo`,
    `$ ${CLI_CMD} harness init pi`,
    `$ ${CLI_CMD} harness update pi`,
    `$ ${CLI_CMD} harness remove pi`,
  ],
});

try {
  await program.run();
} catch (err) {
  console.error("\n" + getErrorMessage(err));
}