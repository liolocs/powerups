import Command from "#Command";
import command_errors, { CommandErrorCode } from "#errors/CommandErrors";
import test from "@rcompat/test";

test.case("Command actions with no flags work", assert => {
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [],
    subcommands: [],
    action: () => {
      return "works";
    },
  });

  assert(command.run()).equals("works");
});

test.case("Command actions with no required flags work", assert => {
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

  assert(command.run()).equals("works");
});

test.case("Command actions with missing required flags fail", assert => {
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

  assert(() =>
    command.run({
      subcommands: [],
      flags: [],
    }))
    .throws(CommandErrorCode.missing_required_flags);
});

test.case("Command actions with required flags succeed", assert => {
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

  assert(() =>
    command.run({
      subcommands: [],
      flags: [{ flag: "-n", value: "John" }],
    }))
    .tries();
});

test.case("Command actions with subcommands with missing subcommands fail", assert => {
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

  assert(() =>
    command.run({
      subcommands: [],
      flags: [],
    }))
    .throws(CommandErrorCode.missing_required_subcommand);
});

test.case("Command actions with subcommands with invalid subcommand fail", assert => {
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

  assert(() =>
    command.run({
      subcommands: ["destroy"],
      flags: [],
    }))
    .throws(CommandErrorCode.invalid_subcommand);
});

test.case("Command actions with subcommands 2 nested subcommands succeed",
  assert => {
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

    assert(() =>
      project.run({
        subcommands: ["create"],
        flags: [{ flag: "-n", value: "newProject" }],
      }))
      .tries();
});