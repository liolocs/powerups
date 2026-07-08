import test from "@rcompat/test";
import { resolveOutputPath } from "#utils/output-path";

test.case("should resolve a single token", async assert => {
  const result = resolveOutputPath("src/{{componentName}}.svelte", {
    componentName: "Button",
  });
  assert(result).equals("src/Button.svelte");
});

test.case("should resolve multiple occurrences of the same token", async assert => {
  const result = resolveOutputPath("src/{{componentName}}/{{componentName}}.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/Button/Button.ts");
});

test.case("should resolve multiple distinct tokens", async assert => {
  const result = resolveOutputPath("src/{{componentName}}-{{theme}}.ts", {
    componentName: "Button",
    theme: "dark",
  });
  assert(result).equals("src/Button-dark.ts");
});

test.case("should match case-insensitively", async assert => {
  // Path uses PascalCase, variables record uses camelCase
  const result = resolveOutputPath("src/{{ComponentName}}.svelte", {
    componentName: "Button",
  });
  assert(result).equals("src/Button.svelte");
});

test.case("should pass through unchanged with no tokens", async assert => {
  const result = resolveOutputPath("src/index.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/index.ts");
});

test.case("should leave unresolved tokens as-is", async assert => {
  const result = resolveOutputPath("src/{{unknownVar}}.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/{{unknownVar}}.ts");
});