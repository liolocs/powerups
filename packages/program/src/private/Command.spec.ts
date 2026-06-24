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