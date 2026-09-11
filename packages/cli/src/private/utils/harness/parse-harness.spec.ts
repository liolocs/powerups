import test from "#test-utils/test/index";
import parseHarness from "#utils/harness/parse-harness";

test.case("returns the harness when it is valid", async assert => {
  assert(parseHarness({ subcommands: ["pi"] })).equals("pi");
});

test.case("throws missing_harness when no positional is passed", async assert => {
  try {
    parseHarness({ subcommands: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_harness");
  }
});

test.case("throws invalid_harness for an unknown harness", async assert => {
  try {
    parseHarness({ subcommands: ["nope"] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("invalid_harness");
  }
});