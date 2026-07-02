import test from "@rcompat/test";
import { default as rcli } from "@rcompat/cli";
import CLI from "#CLI";
import Command from "#Command";

test.case("CLI program returns help message with no args", async assert => {
  const createFlag = {
    name: "name",       // was "create" — should match the flag's name field
    long: "name",
    short: "n",
    description: "Project name",
  } as const;

  const createCommand = new Command({
    name: "create",
    description: "Create a new project",
    flags: [createFlag],
    subcommands: [],
    action: () => "works",
  });

  const program = new CLI({
    name: "dryai",
    description: "test description",
    version: "1.0.0",
    commands: [createCommand],
  });

  rcli.print = test.spy(rcli.print);

  program.run([]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  const expectedMessages = [
    "dryai",
    "Usage: dryai <command>",
    "create",
    "Create a new project",
    "-n, --name",
    "Project name",
    "--help",
  ];

  for (const message of expectedMessages) {
    assert(allOutput.includes(message)).true;
  }
});

test.case("CLI program returns help message with --help flag", async assert => {
  const createCommand = new Command({
    name: "create",
    description: "Create a new project",
    flags: [],
    subcommands: [],
    action: () => "works",
  });

  const program = new CLI({
    name: "dryai",
    description: "test description",
    version: "1.0.0",
    commands: [createCommand],
  });

  rcli.print = test.spy(rcli.print);

  program.run(["--help"]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  assert(allOutput).includes("dryai");
  assert(allOutput).includes("Usage: dryai <command>");
});

test.case("CLI program runs an unknown command and shows help",
  async assert => {
  const createCommand = new Command({
    name: "create",
    description: "Create a new project",
    flags: [],
    subcommands: [],
    action: () => "works",
  });

  const program = new CLI({
    name: "dryai",
    description: "test description",
    version: "1.0.0",
    commands: [createCommand],
  });

  rcli.print = test.spy(rcli.print);

  program.run(["destroy"]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  assert(allOutput).includes("Unknown command: destroy");
});