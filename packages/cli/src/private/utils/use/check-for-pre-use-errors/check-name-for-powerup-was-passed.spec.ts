import use_errors, { UseErrorCode } from "#errors/useErrors";
import test from "#test-utils/test/index";
import checkNameForPowerupWasPassed from "#utils/use/check-for-pre-use-errors/check-name-for-powerup-was-passed";

test.case("should throw an error if a powerup name was undefined", async assert => {
  try {
    checkNameForPowerupWasPassed();
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.missing_name);
  }
});

test.case("should throw an error if a powerup name was not empty string", async assert => {
  try {
    checkNameForPowerupWasPassed("");
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.missing_name);
  }
});

test.case("should not throw an error if a powerup name was passed", async assert => {
  let threw = false;
  try {
    checkNameForPowerupWasPassed("powerup-name");
  } catch {
    threw = true;
  }
  assert(threw).equals(false);
});