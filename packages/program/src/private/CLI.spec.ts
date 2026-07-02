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
    "USAGE",
    "dryai <command> [subcommand] [flags]",
    "CORE COMMANDS",
    "create",
    "Create a new project",
    "-h, --help",
    "Show help for a command",
    "Use \"dryai <command> --help\"",
  ];

  for (const message of expectedMessages) {
    assert(allOutput.includes(message)).true();
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
  assert(allOutput).includes("USAGE");
});

test.case("CLI program shows version with --version flag", async assert => {
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

  program.run(["--version"]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  assert(allOutput).includes("dryai 1.0.0");
});

test.case("CLI program delegates --help to a command's own help",
  async assert => {
  const createFlag = {
    name: "name",
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

  program.run(["create", "--help"]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  assert(allOutput).includes("create — Create a new project");
  assert(allOutput).includes("USAGE");
  assert(allOutput).includes("-n, --name");
  assert(allOutput).includes("Project name");
  assert(allOutput).includes("Show help for create");
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

test.case("CLI program groups subcommands under their own section",
  async assert => {
  const gen = new Command({
    name: "gen",
    description: "Generate a thing",
    flags: [],
    subcommands: [],
    action: () => "works",
  });

  const thing = new Command({
    name: "thing",
    description: "Manage things",
    flags: [],
    subcommands: [gen],
    requiresSubcommand: true,
    action: () => {},
  });

  const program = new CLI({
    name: "dryai",
    description: "test description",
    version: "1.0.0",
    commands: [thing],
  });

  rcli.print = test.spy(rcli.print);

  program.run([]);

  // @ts-expect-error due to spy functions not being typed
  const allOutput = (rcli.print.calls as string[][])
    .map(call => call[0])
    .join("");

  assert(allOutput).includes("THING COMMANDS");
  assert(allOutput).includes("thing gen");
  assert(allOutput).includes("Generate a thing");
});