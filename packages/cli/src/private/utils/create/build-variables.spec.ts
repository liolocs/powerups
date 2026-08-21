import test from "#test-utils/test/index";
import buildVariables from "#utils/create/build-variables";

test.case("should return correct mapping for all fields", async assert => {
  const variables = buildVariables({
    name: "my-powerup",
    description: "A test powerup",
    intent: "create, scaffold",
    requiredVariables: "name, path",
    optionalVariables: "theme",
    powerupType: "multi-use",
    outputPath: ".powerups/installed/_internal",
  });

  assert(variables.name).equals("my-powerup");
  assert(variables.description).equals("A test powerup");
  assert(variables.intent).equals("create, scaffold");
  assert(variables.requiredVariables).equals("name, path");
  assert(variables.optionalVariables).equals("theme");
  assert(variables.powerupType).equals("multi-use");
  assert(variables.outputPath).equals(".powerups/installed/_internal");
});

test.case("should default powerupType to single-use when not passed", async assert => {
  const variables = buildVariables({
    name: "my-powerup",
    outputPath: ".powerups/installed/_internal",
  });

  assert(variables.powerupType).equals("single-use");
});

test.case("should default powerupType to single-use when empty string", async assert => {
  const variables = buildVariables({
    name: "my-powerup",
    powerupType: "",
    outputPath: ".powerups/installed/_internal",
  });

  assert(variables.powerupType).equals("single-use");
});

test.case("should default optional fields to empty strings", async assert => {
  const variables = buildVariables({
    name: "my-powerup",
    outputPath: ".powerups/installed/_internal",
  });

  assert(variables.description).equals("");
  assert(variables.intent).equals("");
  assert(variables.requiredVariables).equals("");
  assert(variables.optionalVariables).equals("");
});

test.case("should use provided outputPath as-is", async assert => {
  const customPath = "some/custom/path";

  const variables = buildVariables({
    name: "my-powerup",
    outputPath: customPath,
  });

  assert(variables.outputPath).equals(customPath);
});