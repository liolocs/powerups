import test from "#test-utils/test/index";
import { UseErrorCode } from "#errors/useErrors";
import extractVariables from "#utils/use/extract-variables";

test.case("extracts variables from raw flags, normalizing to camelCase", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--component-name", value: "foo" },
    ],
    variables: {
      required: ["componentName"],
    },
    excludeFlags: [],
    powerupName: "test-powerup",
  });

  assert(result.componentName).equals("foo");
});

test.case("throws missing_variables when required variables are absent", async assert => {
  try {
    extractVariables({
      rawFlags: [],
      variables: {
        required: ["name"],
      },
      excludeFlags: [],
      powerupName: "test-powerup",
    });
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.missing_variables);
  }
});

test.case("does not throw when all required variables are present", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--name", value: "foo" },
    ],
    variables: {
      required: ["name"],
    },
    excludeFlags: [],
    powerupName: "test-powerup",
  });

  assert(result.name).equals("foo");
});

test.case("applies defaults for optional variables not provided", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--name", value: "foo" },
    ],
    variables: {
      required: ["name"],
      optional: ["theme"],
      defaults: { theme: "dark" },
    },
    excludeFlags: [],
    powerupName: "test-powerup",
  });

  assert(result.theme).equals("dark");
});

test.case("uses empty string for optional variables with no default", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--name", value: "foo" },
    ],
    variables: {
      required: ["name"],
      optional: ["theme"],
    },
    excludeFlags: [],
    powerupName: "test-powerup",
  });

  assert(result.theme).equals("");
});

test.case("filters out excluded flags so they are not treated as variables", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--name", value: "foo" },
      { flag: "--dry-run", value: "true" },
    ],
    variables: {
      required: ["name"],
    },
    excludeFlags: ["--dry-run"],
    powerupName: "test-powerup",
  });

  assert(result.name).equals("foo");
  assert(result.dryRun).undefined();
  assert(result["dry-run"]).undefined();
});

test.case("returns extracted variables merged with defaults without losing user-provided values", async assert => {
  const result = extractVariables({
    rawFlags: [
      { flag: "--name", value: "foo" },
      { flag: "--theme", value: "light" },
    ],
    variables: {
      required: ["name"],
      optional: ["theme"],
      defaults: { theme: "dark" },
    },
    excludeFlags: [],
    powerupName: "test-powerup",
  });

  assert(result.name).equals("foo");
  assert(result.theme).equals("light");
});