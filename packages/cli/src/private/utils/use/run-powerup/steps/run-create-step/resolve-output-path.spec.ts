import test from "#test-utils/test/index";
import resolveOutputPath from "#utils/use/run-powerup/steps/run-create-step/resolve-output-path";

test.case("resolves {{var}} tokens in a path string", async assert => {
  const result = resolveOutputPath({
    outputPath: "src/{{name}}.ts",
    variables: { name: "foo" },
  });

  assert(result).equals("src/foo.ts");
});

test.case("leaves unresolved tokens as-is", async assert => {
  const result = resolveOutputPath({
    outputPath: "src/{{unknown}}.ts",
    variables: { name: "foo" },
  });

  assert(result).equals("src/{{unknown}}.ts");
});

test.case("matches variable keys case-insensitively", async assert => {
  const result = resolveOutputPath({
    outputPath: "src/{{ComponentName}}.ts",
    variables: { componentName: "foo" },
  });

  assert(result).equals("src/foo.ts");
});