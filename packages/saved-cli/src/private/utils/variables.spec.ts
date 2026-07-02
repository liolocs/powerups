import test from "@rcompat/test";
import { normalizeFlagName, toKebabCase, extractVariables } from "#utils/variables";
import { CodeError } from "@rcompat/error";

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
  );
  assert(result.componentName).equals("Button");
  assert(result.theme).equals("dark");
});

test.case("extractVariables excludes declared flags", async assert => {
  // parseArgs types `value` as `string` (noUncheckedIndexedAccess is off),
  // but at runtime a bare `--dry-run` yields value `undefined`. The exclusion
  // matches on the flag name, so a string value exercises the same path.
  const result = extractVariables(
    [{ flag: "--dry-run", value: "true" }, { flag: "--component-name", value: "Button" }],
    ["ComponentName"],
    ["--dry-run", "-d", "--help", "-h"],
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
    );
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("missing_variable");
  }
  assert(threw).true();
});

test.case("extractVariables matches case-insensitively", async assert => {
  // Declared as PascalCase, flag as kebab -> camelCase
  const result = extractVariables(
    [{ flag: "--component-name", value: "Button" }],
    ["ComponentName"],
    [],
  );
  assert(result.componentName).equals("Button");
});