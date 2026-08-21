import test from "#test-utils/test/index";
import generateStepName from "#utils/create/capture-files/generate-step-name";

test.case("should generate a step name with create prefix for a file in a subdirectory", async assert => {
  const result = generateStepName({
    prefix: "create",
    filePath: "src/component.ts",
    existingNames: new Set(),
  });

  assert(result).equals("create-src-component");
});

test.case("should generate a step name with modify prefix for a config file", async assert => {
  const result = generateStepName({
    prefix: "modify",
    filePath: "config.json",
    existingNames: new Set(),
  });

  assert(result).equals("modify-config");
});

test.case("should generate a step name with delete prefix for a readme file", async assert => {
  const result = generateStepName({
    prefix: "delete",
    filePath: "README.md",
    existingNames: new Set(),
  });

  assert(result).equals("delete-README");
});

test.case("should append a numeric suffix when the name already exists", async assert => {
  const existingNames = new Set<string>();

  const first = generateStepName({ prefix: "create", filePath: "src/component.ts", existingNames });
  assert(first).equals("create-src-component");

  const second = generateStepName({ prefix: "create", filePath: "src/component.ts", existingNames });
  assert(second).equals("create-src-component-2");

  const third = generateStepName({ prefix: "create", filePath: "src/component.ts", existingNames });
  assert(third).equals("create-src-component-3");
});

test.case("should handle files without an extension", async assert => {
  const result = generateStepName({
    prefix: "create",
    filePath: "Dockerfile",
    existingNames: new Set(),
  });

  assert(result).equals("create-Dockerfile");
});