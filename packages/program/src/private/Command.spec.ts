import Command from "#Command";
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
    long: "name",
    short: "n",
    description: "Project name",
    required: true
  };
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: () => {
      return "fails"
    },
  });

  assert(command.run()).throws(
    "Missing required arguments for the  test  command",
  );
});

test.case("Command actions with required flags succeed", assert => {
});

test.case("Command actions with subcommands with missing subcommands fail", assert => {
});

test.case("Command actions with subcommands with invalid subcommand fail", assert => {
});

test.case("Command actions with subcommands 2 nested subcommands succeed", assert => {
});