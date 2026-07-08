import test from "@rcompat/test";
import { resolveTemplateString } from "#utils/resolve-template-string";

test.case("should resolve a single token", async assert => {
  const result = resolveTemplateString("src/{{componentName}}.svelte", {
    componentName: "Button",
  });
  assert(result).equals("src/Button.svelte");
});

test.case("should resolve multiple occurrences of the same token", async assert => {
  const result = resolveTemplateString("src/{{componentName}}/{{componentName}}.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/Button/Button.ts");
});

test.case("should resolve multiple distinct tokens", async assert => {
  const result = resolveTemplateString("src/{{componentName}}-{{theme}}.ts", {
    componentName: "Button",
    theme: "dark",
  });
  assert(result).equals("src/Button-dark.ts");
});

test.case("should match case-insensitively", async assert => {
  const result = resolveTemplateString("src/{{ComponentName}}.svelte", {
    componentName: "Button",
  });
  assert(result).equals("src/Button.svelte");
});

test.case("should pass through unchanged with no tokens", async assert => {
  const result = resolveTemplateString("src/index.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/index.ts");
});

test.case("should leave unresolved tokens as-is", async assert => {
  const result = resolveTemplateString("src/{{unknownVar}}.ts", {
    componentName: "Button",
  });
  assert(result).equals("src/{{unknownVar}}.ts");
});

test.case("should resolve mixed text and tokens", async assert => {
  const result = resolveTemplateString("{{theme}}-button", {
    theme: "dark",
  });
  assert(result).equals("dark-button");
});