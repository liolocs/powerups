import Command from "#Command";
import test from "@rcompat/test";

test.case("Command actions work", assert => {
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

test.case("Command actions flags work", assert => {
  const flag = { long: "name", short: "n", description: "Project name" };
  const command = new Command({
    name: "test",
    description: "test description",
    flags: [flag],
    subcommands: [],
    action: (flags) => {
      return flags[0].long;
    },
  });

  assert(command.run()).equals(flag.long);
});