import test from "#test-utils/test/index";
import checkHarnessForErrors from "#utils/harness/check-harness-for-errors";

test.case("throws missing_harness when no positional is passed", async assert => {
  try {
    checkHarnessForErrors();

    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_harness");
  }
});

test.case("throws invalid_harness for an unknown harness", async assert => {
  try {
    checkHarnessForErrors("random-harness");

    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("invalid_harness");
  }
});