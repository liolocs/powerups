import test from "@rcompat/test";
import Command from "#Command";
import parseArgs, { collectFlagTypes } from "#parseArgs";

test.case("A series of args are recognised", assert => {
  const args = ["-n=John", "--project=calypso"];

  const parsed = parseArgs(args);
  assert(parsed.flags.length).equals(2);
  assert(parsed.commands.length).equals(0);
});

test.case("A series of args with commands are recognised", assert => {
  const args = ["create", "-n=John", "--project=calypso"];

  const parsed = parseArgs(args);
  assert(parsed.flags.length).equals(2);
  assert(parsed.commands.length).equals(1);
});

test.case("A series of flags have correct values", assert => {
  const args = ["-n=John", "--project=calypso"];

  const parsed = parseArgs(args);
  assert(parsed.flags.length).equals(2);
  assert(parsed.flags[0].value).equals("John");
  assert(parsed.flags[1].value).equals("calypso");
});

test.case("A value containing an equals sign is kept in full", assert => {
  const parsed = parseArgs(["--msg=a=b"]);

  assert(parsed.flags.length).equals(1);
  assert(parsed.flags[0].flag).equals("--msg");
  assert(parsed.flags[0].value).equals("a=b");
});

test.case("Space-separated long flag value is consumed", assert => {
  const parsed = parseArgs(["--name", "John"], { name: "string" });

  assert(parsed.flags.length).equals(1);
  assert(parsed.flags[0].flag).equals("--name");
  assert(parsed.flags[0].value).equals("John");
  assert(parsed.commands.length).equals(0);
});

test.case("Space-separated short flag value is consumed", assert => {
  const parsed = parseArgs(["-n", "John"], { n: "string" });

  assert(parsed.flags[0].flag).equals("-n");
  assert(parsed.flags[0].value).equals("John");
});

test.case("Unknown flags consume space-separated values", assert => {
  const parsed = parseArgs(["--componentName", "Button"]);

  assert(parsed.flags[0].flag).equals("--componentName");
  assert(parsed.flags[0].value).equals("Button");
  assert(parsed.commands.length).equals(0);
});

test.case("Boolean flags do not consume the next arg", assert => {
  const parsed = parseArgs(
    ["--dry-run", "find", "-q", "x"],
    { "dry-run": "boolean", dr: "boolean", q: "string" },
  );

  assert(parsed.flags[0].flag).equals("--dry-run");
  assert(parsed.flags[0].value === undefined).true();
  assert(parsed.flags[1].value).equals("x");
  assert(parsed.commands).equals(["find"]);
});

test.case("Space-separated value containing an equals sign is kept in full",
  assert => {
  const parsed = parseArgs(["--msg", "a=b"], { msg: "string" });

  assert(parsed.flags[0].value).equals("a=b");
});

test.case("An empty equals value stays an empty string", assert => {
  const parsed = parseArgs(["--name="], { name: "string" });

  assert(parsed.flags[0].value).equals("");
});

test.case("A flag at the end of argv has no value", assert => {
  const parsed = parseArgs(["--name"], { name: "string" });

  assert(parsed.flags[0].value === undefined).true();
});

test.case("A value starting with a dash is not consumed", assert => {
  const parsed = parseArgs(["--name", "-x"], { name: "string" });

  assert(parsed.flags[0].value === undefined).true();
  assert(parsed.flags[1].flag).equals("-x");
  assert(parsed.commands.length).equals(0);
});

test.case("Equals and space forms mix in one invocation", assert => {
  const parsed = parseArgs(
    ["use", "-q=x", "find", "--dry-run"],
    { q: "string", "dry-run": "boolean" },
  );

  assert(parsed.flags[0].flag).equals("-q");
  assert(parsed.flags[0].value).equals("x");
  assert(parsed.flags[1].flag).equals("--dry-run");
  assert(parsed.flags[1].value === undefined).true();
  assert(parsed.commands).equals(["use", "find"]);
});

test.case("A bare double dash is a valueless flag", assert => {
  const parsed = parseArgs(["--", "x"]);

  assert(parsed.flags[0].flag).equals("--");
  assert(parsed.flags[0].value === undefined).true();
  assert(parsed.commands).equals(["x"]);
});

test.case("collectFlagTypes merges long and short keys across subcommands",
  assert => {
  const findCommand = new Command({
    name: "find",
    description: "Find powerups",
    flags: [{
      name: "query", long: "query", short: "q",
      description: "Search query",
    } as const],
    subcommands: [],
    action: () => {},
  });

  const useCommand = new Command({
    name: "use",
    description: "Use a powerup",
    flags: [{
      name: "dryRun", long: "dry-run", short: "dr",
      description: "Dry run", type: "boolean",
    } as const],
    subcommands: [findCommand],
    action: () => {},
  });

  const flagTypes = collectFlagTypes({
    commands: [useCommand],
    extraFlags: { help: "boolean" },
  });

  assert(flagTypes["dry-run"]).equals("boolean");
  assert(flagTypes.dr).equals("boolean");
  assert(flagTypes.query).equals("string");
  assert(flagTypes.q).equals("string");
  assert(flagTypes.help).equals("boolean");
});

test.case("collectFlagTypes resolves conflicts to string", assert => {
  const createCommand = new Command({
    name: "create",
    description: "Create a powerup",
    flags: [{
      name: "variables", long: "variables", short: "v",
      description: "Variables",
    } as const],
    subcommands: [],
    action: () => {},
  });

  const flagTypes = collectFlagTypes({
    commands: [createCommand],
    extraFlags: { v: "boolean", version: "boolean" },
  });

  assert(flagTypes.v).equals("string");
  assert(flagTypes.version).equals("boolean");
});
