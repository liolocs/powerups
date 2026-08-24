import Command from "#Command";
import { CommandErrorCode } from "#errors/CommandErrors";
import type { CodeError } from "@rcompat/error";
import test from "@rcompat/test";

test.case("Command actions with no flags work", async assert => {
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [],
    subcommands: [],
    action: () => {
      return "works";
    },
  });

  assert(await command.run()).equals("works");
});

test.case("Command actions with no required flags work", async assert => {
  const flag = {
    name: "name",
    long: "name",
    short: "n",
    description: "Project name",
  };

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: () => {
      return "works";
    },
  });

  assert(await command.run()).equals("works");
});

test.case("Command actions with missing required flags fail", async assert => {
  const flag = {
    name: "name",
    long: "name",
    short: "n",
    description: "Project name",
    required: true,
  };
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: () => {
      return "fails";
    },
  });

  try {
    await command.run({
      subcommands: [],
      flags: [],
    });
  } catch (e) {
    assert((e as CodeError).code)
      .equals(CommandErrorCode.missing_required_flags);
  }
});

test.case("Command actions with required flags succeed", async assert => {
  const flag = {
    name: "name",
    long: "name",
    short: "n",
    description: "Project name",
    required: true,
  };
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: () => {
      return "fails";
    },
  });

  let error;

  try {
    await command.run({
      subcommands: [],
      flags: [{ flag: "-n", value: "John" }],
    });
  } catch (e) {
    error = e as CodeError;
  }

  assert(error).not.defined();
});

test.case("Command actions with subcommands with missing subcommands fail",
  async assert => {
    const create = new Command({
      name: "create",
      description: "create a project",
      flags: [],
      subcommands: [],
      action: () => "created",
    });

    const command = new Command({
      name: "project",
      description: "project command",
      flags: [],
      subcommands: [create],
      requiresSubcommand: true,
      action: () => "project",
    });

    try {
      await command.run({
        subcommands: [],
        flags: [],
      });
    } catch (e) {
      assert((e as CodeError).code)
        .equals(CommandErrorCode.missing_required_subcommand);
    }
  });

test.case("Command actions with subcommands with invalid subcommand fail",
  async assert => {
    const create = new Command({
      name: "create",
      description: "create a project",
      flags: [],
      subcommands: [],
      action: () => "created",
    });

    const command = new Command({
      name: "project",
      description: "project command",
      flags: [],
      subcommands: [create],
      action: () => "project",
    });

    try {
      await command.run({
        subcommands: ["destroy"],
        flags: [],
      });
    } catch (e) {
      assert((e as CodeError).code)
        .equals(CommandErrorCode.invalid_subcommand);
    }
  });

test.case("Command actions with subcommands 2 nested subcommands succeed",
  async assert => {
    const flag = {
      name: "name",
      long: "name",
      short: "n",
      description: "Project name",
      required: true,
    } as const;

    const create = new Command({
      name: "create",
      description: "create a project",
      flags: [flag],
      subcommands: [],
      action: (props) =>
        `created ${props.flags.name}`,
    });

    const project = new Command({
      name: "project",
      description: "project command",
      flags: [],
      subcommands: [create],
      action: () => "project",
    });

    let error;

    try {
      await project.run({
        subcommands: ["create"],
        flags: [{ flag: "-n", value: "newProject" }],
      });
    } catch (e) {
      error = e as CodeError;
    }

    assert(error).not.defined();
  });

test.case("Command passes rawFlags including undeclared flags", async assert => {
  const flag = {
    name: "name",
    long: "name",
    short: "n",
    description: "Project name",
  } as const;

  let receivedRawFlags: { flag: string; value?: string }[] | undefined;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: (props) => {
      receivedRawFlags = props.rawFlags;
      return "ok";
    },
  });

  await command.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "test" },
      { flag: "--extra-flag", value: "extra-value" },
    ],
  });

  assert(receivedRawFlags!).defined();
  assert(receivedRawFlags!.length).equals(2);
  assert(receivedRawFlags![1].flag).equals("--extra-flag");
});

test.case("Boolean flag passed without value returns true", async assert => {
  const flag = {
    name: "verbose",
    long: "verbose",
    short: "v",
    description: "Verbose output",
    type: "boolean",
  } as const;

  let receivedValue: boolean | undefined;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: (props) => {
      receivedValue = props.flags.verbose;
      return "ok";
    },
  });

  await command.run({
    subcommands: [],
    flags: [{ flag: "--verbose" }],
  });

  assert(receivedValue).equals(true);
});

test.case("Boolean flag not passed returns false", async assert => {
  const flag = {
    name: "verbose",
    long: "verbose",
    short: "v",
    description: "Verbose output",
    type: "boolean",
  } as const;

  let receivedValue: boolean | undefined;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: (props) => {
      receivedValue = props.flags.verbose;
      return "ok";
    },
  });

  await command.run({
    subcommands: [],
    flags: [],
  });

  assert(receivedValue).equals(false);
});

test.case("Boolean flag passed with short form returns true", async assert => {
  const flag = {
    name: "verbose",
    long: "verbose",
    short: "v",
    description: "Verbose output",
    type: "boolean",
  } as const;

  let receivedValue: boolean | undefined;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: (props) => {
      receivedValue = props.flags.verbose;
      return "ok";
    },
  });

  await command.run({
    subcommands: [],
    flags: [{ flag: "-v" }],
  });

  assert(receivedValue).equals(true);
});

test.case("Boolean flag passed with value throws error", async assert => {
  const flag = {
    name: "verbose",
    long: "verbose",
    short: "v",
    description: "Verbose output",
    type: "boolean",
  } as const;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: () => "ok",
  });

  try {
    await command.run({
      subcommands: [],
      flags: [{ flag: "--verbose", value: "something" }],
    });
  } catch (e) {
    assert((e as CodeError).code)
      .equals(CommandErrorCode.invalid_boolean_flag_value);
  }
});

test.case("Boolean and string flags work together", async assert => {
  const verboseFlag = {
    name: "verbose",
    long: "verbose",
    short: "v",
    description: "Verbose output",
    type: "boolean",
  } as const;
  const nameFlag = {
    name: "name",
    long: "name",
    short: "n",
    description: "Project name",
  } as const;

  let receivedVerbose: boolean | undefined;
  let receivedName: string | undefined;

  const command = new Command({
    name: "test",
    description: "test description",
    flags: [verboseFlag, nameFlag],
    subcommands: [],
    action: (props) => {
      receivedVerbose = props.flags.verbose;
      receivedName = props.flags.name;
      return "ok";
    },
  });

  await command.run({
    subcommands: [],
    flags: [
      { flag: "--verbose" },
      { flag: "--name", value: "myproject" },
    ],
  });

  assert(receivedVerbose).equals(true);
  assert(receivedName).equals("myproject");
});