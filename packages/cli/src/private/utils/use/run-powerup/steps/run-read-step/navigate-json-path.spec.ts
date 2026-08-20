import test from "#test-utils/test/index";
import navigateJsonPath from "#utils/use/run-powerup/steps/run-read-step/navigate-json-path";

test.case("navigates a nested dot path to a string value", async assert => {
  const result = navigateJsonPath({
    json: { user: { profile: { name: "Alice" } } },
    path: "user.profile.name",
  });

  assert(result).equals("Alice");
});

test.case("navigates to a top-level key", async assert => {
  const result = navigateJsonPath({
    json: { config: "production" },
    path: "config",
  });

  assert(result).equals("production");
});

test.case("throws when path does not exist", async assert => {
  let threw = false;
  try {
    navigateJsonPath({
      json: { user: { name: "Alice" } },
      path: "user.nonexistent",
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("throws when traversing through a non-object value", async assert => {
  let threw = false;
  try {
    navigateJsonPath({
      json: { user: { name: "Alice" } },
      path: "user.name.length",
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
});

test.case("returns string representation of a numeric value", async assert => {
  const result = navigateJsonPath({
    json: { config: { port: 3000 } },
    path: "config.port",
  });

  assert(result).equals("3000");
});