import test from "#test-utils/test/index";
import shared_errors, { SharedErrorCode } from "#errors/sharedErrors";

test.case("should include the parse detail in the error message", async assert => {
  try {
    throw shared_errors.invalid_powerup_property("some parse error detail");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(SharedErrorCode.invalid_powerup_property);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("some parse error detail");
  }
});

test.case("should reference the instructions field requirement", async assert => {
  try {
    throw shared_errors.invalid_powerup_property("test");
  } catch (error) {
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("instructions");
  }
});