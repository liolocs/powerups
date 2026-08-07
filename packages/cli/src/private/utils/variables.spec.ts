import test from "@rcompat/test";
import {
  normalizeFlagName,
  toKebabCase,
  extractVariables,
} from "#utils/variables";

function throwMissing(missing: string[]): never {
  throw new Error(`Missing required variables: ${missing.join(", ")}`);
}

test.case("should convert kebab to camelCase with normalizeFlagName", async assert => {
  assert(normalizeFlagName("--component-name")).equals("componentName");
  assert(normalizeFlagName("--theme")).equals("theme");
  assert(normalizeFlagName("--my-long-variable")).equals("myLongVariable");
  assert(normalizeFlagName("-x")).equals("x");
  assert(normalizeFlagName("--a")).equals("a");
});

test.case("should convert PascalCase/camelCase to kebab with toKebabCase", async assert => {
  assert(toKebabCase("ComponentName")).equals("component-name");
  assert(toKebabCase("theme")).equals("theme");
  assert(toKebabCase("MyLongVariable")).equals("my-long-variable");
});

test.case("should return a camelCase record from extractVariables", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--component-name", value: "Button" }, { flag: "--theme", value: "dark" }],
    required: ["ComponentName", "theme"],
    optional: [],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
  assert(result.theme).equals("dark");
});

test.case("should exclude declared flags in extractVariables", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--dry-run", value: "true" }, { flag: "--component-name", value: "Button" }],
    required: ["ComponentName"],
    optional: [],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
  assert(result["dry-run"]).equals(undefined);
  assert(result["dryRun"]).equals(undefined);
});

test.case("should ignore undeclared extra flags in extractVariables", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--component-name", value: "Button" }, { flag: "--extra", value: "ignored" }],
    required: ["ComponentName"],
    optional: [],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
  assert(result.extra).equals("ignored");
});

test.case("should default optional variables to empty string when not provided", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--component-name", value: "Button" }],
    required: ["ComponentName"],
    optional: ["sub", "subDescription"],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
  assert(result.sub).equals("");
  assert(result.subDescription).equals("");
});

test.case("should apply declared defaults to optional variables when not provided", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--name", value: "greet" }],
    required: ["name"],
    optional: ["outputPath", "type"],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    defaults: { outputPath: ".powerups/_internal", type: "single-use" },
    onMissing: throwMissing,
  });
  assert(result.name).equals("greet");
  assert(result.outputPath).equals(".powerups/_internal");
  assert(result.type).equals("single-use");
});

test.case("provided optional values override declared defaults", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--name", value: "greet" }, { flag: "--output-path", value: "elsewhere" }],
    required: ["name"],
    optional: ["outputPath"],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    defaults: { outputPath: ".powerups/_internal" },
    onMissing: throwMissing,
  });
  assert(result.outputPath).equals("elsewhere");
});

test.case("should use provided optional variable values", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--component-name", value: "Button" }, { flag: "--sub", value: "detail" }],
    required: ["ComponentName"],
    optional: ["sub"],
    excludeFlags: ["--dry-run", "-d", "--help", "-h"],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
  assert(result.sub).equals("detail");
});

test.group("variables errors", () => {
  test.case("should throw on a missing required variable in extractVariables", async assert => {
  let threw = false;
  try {
    extractVariables({
      rawFlags: [{ flag: "--theme", value: "dark" }],
      required: ["ComponentName", "theme"],
      optional: [],
      excludeFlags: ["--dry-run", "-d", "--help", "-h"],
      onMissing: throwMissing,
    });
  } catch (e) {
    threw = true;
    assert((e as Error).message).includes("Missing required variables: ComponentName");
  }
  assert(threw).true();
  });

  test.case("should collect all missing required variables", async assert => {
  let threw = false;
  try {
    extractVariables({
      rawFlags: [],
      required: ["name", "description", "theme"],
      optional: [],
      excludeFlags: ["--dry-run", "-d", "--help", "-h"],
      onMissing: throwMissing,
    });
  } catch (e) {
    threw = true;
    assert((e as Error).message).includes("Missing required variables: name, description, theme");
  }
  assert(threw).true();
  });

  test.case("should only report missing required variables, not provided ones", async assert => {
  let threw = false;
  try {
    extractVariables({
      rawFlags: [{ flag: "--name", value: "test" }],
      required: ["name", "description"],
      optional: [],
      excludeFlags: ["--dry-run", "-d", "--help", "-h"],
      onMissing: throwMissing,
    });
  } catch (e) {
    threw = true;
    assert((e as Error).message).includes("Missing required variables: description");
    assert((e as Error).message.includes("name")).false();
  }
  assert(threw).true();
  });
});

test.case("should match case-insensitively in extractVariables", async assert => {
  const result = extractVariables({
    rawFlags: [{ flag: "--component-name", value: "Button" }],
    required: ["ComponentName"],
    optional: [],
    excludeFlags: [],
    onMissing: throwMissing,
  });
  assert(result.componentName).equals("Button");
});