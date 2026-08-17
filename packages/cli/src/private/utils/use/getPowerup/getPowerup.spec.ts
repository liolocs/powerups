import test from "#test-utils/test/index";
import getPowerup from "#utils/use/getPowerup/getPowerup";
import { UseErrorCode } from "#errors/useErrors";

test.case("should return the found powerup", async assert => {
  let threw = false;
  try {

  const powerup = await getPowerup("test-powerup");

  assert(powerup.instructions.name).equals("test-powerup");
  } catch {
    threw = true;
  }
  assert(threw).false();
});

test.case("should give an error if the powerup was not found", async assert => {
  await assert(getPowerup("test-powerup")).throwsAsync(UseErrorCode.not_found);
});