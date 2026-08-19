import test from "#test-utils/test/index";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";

test.case("resolves {{var}} tokens in a string using provided variables", async assert => {
  const result = applyVariablesToTemplateString({
    templateString: "src/{{name}}.ts",
    variables: { name: "foo" },
  });

  assert(result).equals("src/foo.ts");
});

test.case("matches variable keys case-insensitively", async assert => {
  const result = applyVariablesToTemplateString({
    templateString: "src/{{ComponentName}}.ts",
    variables: { componentName: "foo" },
  });

  assert(result).equals("src/foo.ts");
});

test.case("leaves unresolved tokens as-is", async assert => {
  const result = applyVariablesToTemplateString({
    templateString: "src/{{unknown}}.ts",
    variables: { name: "foo" },
  });

  assert(result).equals("src/{{unknown}}.ts");
});

test.case("resolves multiple tokens in the same string", async assert => {
  const result = applyVariablesToTemplateString({
    templateString: "{{dir}}/{{name}}.{{ext}}",
    variables: { dir: "src", name: "foo", ext: "ts" },
  });

  assert(result).equals("src/foo.ts");
});

test.case("returns the string unchanged when it has no tokens", async assert => {
  const result = applyVariablesToTemplateString({
    templateString: "src/foo.ts",
    variables: { name: "bar" },
  });

  assert(result).equals("src/foo.ts");
});