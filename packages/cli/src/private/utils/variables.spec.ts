import test from "@rcompat/test";
import {
  normalizeFlagName,
  toKebabCase,
  extractVariables,
} from "#utils/variables";

function throwMissing(variable: string, _flagName: string): never {
  throw new Error(`Missing required variable: ${variable}`);
}

test.case("normalizeFlagName converts kebab to camelCase", async assert => {
  assert(normalizeFlagName("--component-name")).equals("componentName");
  assert(normalizeFlagName("--theme")).equals("theme");
  assert(normalizeFlagName("--my-long-variable")).equals("myLongVariable");
  assert(normalizeFlagName("-x")).equals("x");
  assert(normalizeFlagName("--a")).equals("a");
});

test.case("toKebabCase converts PascalCase/camelCase to kebab", async assert => {
  assert(toKebabCase("ComponentName")).equals("component-name");
  assert(toKebabCase("theme")).equals("theme");
  assert(toKebabCase("MyLongVariable")).equals("my-long-variable");
});

test.case("extractVariables returns camelCase record", async assert => {
  const result = extractVariables(
    [{ flag: "--component-name", value: "Button" }, { flag: "--theme", value: "dark" }],
    ["ComponentName", "theme"],
    ["--dry-run", "-d", "--help", "-h"],
    throwMissing,
  );
  assert(result.componentName).equals("Button");
  assert(result.theme).equals("dark");
});

test.case("extractVariables excludes declared flags", async assert => {
  const result = extractVariables(
    [{ flag: "--dry-run", value: "true" }, { flag: "--component-name", value: "Button" }],
    ["ComponentName"],
    ["--dry-run", "-d", "--help", "-h"],
    throwMissing,
  );
  assert(result.componentName).equals("Button");
  assert(result["dry-run"]).equals(undefined);
  assert(result["dryRun"]).equals(undefined);
});

test.case("extractVariables ignores undeclared extra flags", async assert => {
  const result = extractVariables(
    [{ flag: "--component-name", value: "Button" }, { flag: "--extra", value: "ignored" }],
    ["ComponentName"],
    ["--dry-run", "-d", "--help", "-h"],
    throwMissing,
  );
  assert(result.componentName).equals("Button");
  assert(result.extra).equals("ignored");
});

test.case("extractVariables throws on missing declared variable", async assert => {
  let threw = false;
  try {
    extractVariables(
      [{ flag: "--theme", value: "dark" }],
      ["ComponentName", "theme"],
      ["--dry-run", "-d", "--help", "-h"],
      throwMissing,
    );
  } catch (e) {
    threw = true;
    assert((e as Error).message).includes("Missing required variable: ComponentName");
  }
  assert(threw).true();
});

test.case("extractVariables matches case-insensitively", async assert => {
  const result = extractVariables(
    [{ flag: "--component-name", value: "Button" }],
    ["ComponentName"],
    [],
    throwMissing,
  );
  assert(result.componentName).equals("Button");
});