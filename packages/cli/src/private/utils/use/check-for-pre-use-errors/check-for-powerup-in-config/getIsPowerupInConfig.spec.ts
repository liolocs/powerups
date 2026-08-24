import test from "#test-utils/test/index";
import getIsPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig";

test.case("should return true if the powerup is in the config with a source prefix", async assert => {
  const config = {
    packages: ["internal:test-powerup"],
  };

  const result = getIsPowerupInConfig({ config, powerupName: "test-powerup" });

  assert(result).true();
});

test.case("should return true if the powerup is in the config as a package object", async assert => {
  const config = {
    packages: [{ package: "internal:test-powerup" }],
  };

  const result = getIsPowerupInConfig({ config, powerupName: "test-powerup" });

  assert(result).true();
});

test.case("should return true if the powerup is in the config as an object with name field", async assert => {
  const config = {
    packages: [{ package: "git:github.com/owner/repo", name: "test-powerup" }],
  };

  const result = getIsPowerupInConfig({ config, powerupName: "test-powerup" });

  assert(result).true();
});

test.case("should return false if the powerup is NOT in the config", async assert => {
  const config = {
    packages: [],
  };

  const result = getIsPowerupInConfig({ config, powerupName: "test-powerup" });

  assert(result).false();
});

test.case("should return false if the powerupName empty", async assert => {
  const config = {
    packages: ["internal:test-powerup"],
  };

  const result = getIsPowerupInConfig({ config, powerupName: "" });

  assert(result).false();
});

test.case("should return false if the powerupName undefined", async assert => {
  const config = {
    packages: ["internal:test-powerup"],
  };

  const result = getIsPowerupInConfig({ config });

  assert(result).false();
});