import test from "@rcompat/test";
import { collectTemplatePaths, parseInstructions, resolveTemplateContent } from "./fetch-package-detail.ts";

const helloWorldInstructionsJson = [
  "{",
  "  \"name\": \"powerup-hello-world\",",
  "  \"type\": \"single-use\",",
  "  \"description\": \"A powerup useful for testing\",",
  "  \"variables\": { \"required\": [], \"optional\": [] },",
  "  \"intent\": [],",
  "  \"steps\": [",
  "    { \"type\": \"create\", \"name\": \"Hello World\", \"template\": \"src/index.ts\", \"outputPath\": \"index.ts\" },",
  "    { \"type\": \"create\", \"name\": \"package.json\", \"template\": \"src/packageJson.ts\", \"outputPath\": \"package.json\" }",
  "  ]",
  "}",
].join("\n");

const malformedInstructionsJson = [
  "{",
  "  \"name\": \"x\",",
  "  \"type\": \"multi-use\",",
  "  \"description\": \"\",",
  "  \"intent\": [\"do things\"],",
  "  \"variables\": { \"required\": [\"name\"], \"optional\": [\"greeting\"], \"defaults\": { \"greeting\": \"hello\" } },",
  "  \"steps\": [",
  "    { \"type\": \"create\", \"name\": \"ok\", \"template\": \"a.ts\", \"outputPath\": \"a.ts\" },",
  "    { \"type\": \"explode\", \"name\": \"bad\" }",
  "  ]",
  "}",
].join("\n");

test.case("parses real published instructions", async assert => {
  const instructions = parseInstructions({ instructionsJson: helloWorldInstructionsJson });

  assert(instructions?.name).equals("powerup-hello-world");
  assert(instructions?.type).equals("single-use");
  assert(instructions?.description).equals("A powerup useful for testing");
  assert(instructions?.variables.required.length).equals(0);
  assert(instructions?.intent.length).equals(0);
  assert(instructions?.steps.length).equals(2);
});

test.case("returns null for unparseable or non-object instructions", async assert => {
  assert(parseInstructions({ instructionsJson: "not json" }) === null).equals(true);
  assert(parseInstructions({ instructionsJson: "[1, 2]" }) === null).equals(true);
});

test.case("normalizes defensively and drops unknown step types", async assert => {
  const instructions = parseInstructions({ instructionsJson: malformedInstructionsJson });

  assert(instructions?.type).equals("multi-use");
  assert(instructions?.variables.required.length).equals(1);
  assert(instructions?.variables.required[0]).equals("name");
  assert(instructions?.variables.optional?.length).equals(1);
  assert(instructions?.variables.defaults?.greeting).equals("hello");
  assert(instructions?.intent.length).equals(1);
  assert(instructions?.steps.length).equals(1);
});

test.case("collects unique template paths in step order", async assert => {
  const instructions = parseInstructions({ instructionsJson: helloWorldInstructionsJson });

  assert(instructions === null).equals(false);
  if (instructions !== null) {
    assert(collectTemplatePaths({ instructions }).join(",")).equals("src/index.ts,src/packageJson.ts");
  }
});

test.case("resolves template content from the dist folder", async assert => {
  const templateFiles = new Map([["dist/src/index.ts", "export default () => 'hi';"]]);

  assert(resolveTemplateContent({ templateFiles, templatePath: "src/index.ts" })).equals("export default () => 'hi';");
  assert(resolveTemplateContent({ templateFiles, templatePath: "src/missing.ts" }) === null).equals(true);
});
