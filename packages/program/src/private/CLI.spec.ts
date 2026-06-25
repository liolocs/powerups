import test from "@rcompat/test";
import { default as rcli } from "@rcompat/cli";
import CLI from "#CLI";
import Command from "#Command";

test.case("CLI program returns help message with no args", async assert => {
  const createFlag = {
    long: "name",
    short: "n",
    description: "Project name",
  };

  const createCommand = new Command({
    name: "create",
    description: "Create a new project",
    flags: [createFlag],
    subcommands: [],
    action: () => {
      return "works";
    },
  });

  const program = new CLI({
    name: "dryai",
    description: "test description",
    version: "1.0.0",
    commands: [createCommand],
  });

  rcli.print = test.spy(rcli.print);

  program.run();

  // @ts-expect-error due to spy functions not being typed
  assert(rcli.print.calls[0][0]).includes("Welcome to dryai!");

  const containedMessages = [
    "Welcome to dryai!",
    "Usage: dryai <command>",
    "Available Commands:",
    "create",
    "Create a new project",
    "Options:",
    "  -n, --name",
    "Project name",
  ];

  const foundMessages = [];

  // @ts-expect-error due to spy functions not being typed
  for (const call of rcli.print.calls) {
    for (const message of containedMessages) {
      if (call[0].includes(message) === true) {
        foundMessages.push(message);
      }
    }
  }

  assert(foundMessages.length).equals(containedMessages.length);
});