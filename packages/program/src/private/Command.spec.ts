import Command from "#Command";
import { CommandErrorCode } from "#errors/CommandErrors";
import { CodeError } from "@rcompat/error";
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
    error = e as CodeError
  }

  assert(error).not.defined()
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
      error = e as CodeError
    }

    assert(error).not.defined()
  });