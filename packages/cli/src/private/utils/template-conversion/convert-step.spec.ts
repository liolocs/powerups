import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { convertStepToDynamic, revertStepToStatic } from "#utils/template-conversion/convert-step";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/convert-step");

const staticCreateStep = {
  type: "create",
  name: "pkg",
  file: "src/create/package.json",
  outputPath: "package.json",
} as const;

const staticModifyStep = {
  type: "modify",
  name: "pkg-mod",
  file: "src/modify/package.json.json",
  outputPath: "package.json",
} as const;

test.case("converts a static create step to dynamic-create with a readable template", async assert => {
  const content = "{\n  \"name\": \"hello\"\n}";
  const result = convertStepToDynamic({ step: staticCreateStep, sourceContent: content, engine: "ts" });

  assert(result.newStep.type).equals("dynamic-create");
  assert(result.templatePath).equals("src/dynamic-create/package.json.ts");
  assert(result.templateContent).includes("`{");
  assert(result.templateContent).includes("\"name\": \"hello\"");
  assert((result.newStep as { file?: string }).file).equals(undefined);
});

test.case("converts a static modify step to dynamic-modify with .modify.ts naming", async assert => {
  const content = "[\n  {\n    \"where\": \"top\",\n    \"content\": \"x\"\n  }\n]";
  const result = convertStepToDynamic({ step: staticModifyStep, sourceContent: content, engine: "ts" });

  assert(result.newStep.type).equals("dynamic-modify");
  assert(result.templatePath).equals("src/dynamic-modify/package.json.modify.ts");
});

test.case("njk engine wraps nothing and uses .njk paths", async assert => {
  const content = "plain content {{name}}";
  const result = convertStepToDynamic({ step: staticCreateStep, sourceContent: content, engine: "njk" });

  assert(result.templatePath).equals("src/dynamic-create/package.json.njk");
  assert(result.templateContent).equals(content);
});

test.case("reverts a dynamic-create template without variables to static", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return \`plain\`;\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-create/plain.txt.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  const result = await revertStepToStatic({
    step: { type: "dynamic-create", name: "plain", template: "src/dynamic-create/plain.txt.ts", outputPath: "plain.txt" },
    powerupRoot: testRoot,
    variables: {},
    declaredVariableNames: ["name"],
  });

  assert(result.newStep.type).equals("create");
  assert(result.staticPath).equals("src/create/plain.txt");
  assert(result.staticContent).equals("plain");

  await testRoot.remove({ recursive: true });
});

test.case("revert throws revert_needs_variables when the template uses unset variables", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return \`hello \${_variables.name}\`;\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-create/greet.txt.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  try {
    await revertStepToStatic({
      step: { type: "dynamic-create", name: "greet", template: "src/dynamic-create/greet.txt.ts", outputPath: "greet.txt" },
      powerupRoot: testRoot,
      variables: {},
      declaredVariableNames: ["name"],
    });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("revert_needs_variables");
  }

  await testRoot.remove({ recursive: true });
});

test.case("revert renders with provided variables and pretty-prints dynamic-modify output", async assert => {
  await fs.create(testRoot);
  const templateContent = `export default function (_variables: Record<string, string>): string {\n  return JSON.stringify([{ where: "top", content: "dep " + _variables.depName }]);\n}\n`;
  const templateRef = testRoot.append("/src/dynamic-modify/package.json.modify.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(templateContent);

  const result = await revertStepToStatic({
    step: { type: "dynamic-modify", name: "pkg-mod", template: "src/dynamic-modify/package.json.modify.ts", outputPath: "package.json" },
    powerupRoot: testRoot,
    variables: { depName: "zod" },
    declaredVariableNames: ["depName"],
  });

  assert(result.newStep.type).equals("modify");
  assert(result.staticPath).equals("src/modify/package.json.json");
  assert(result.staticContent).includes("[\n  {\n    \"where\": \"top\",");
  assert(result.staticContent).includes("dep zod");

  await testRoot.remove({ recursive: true });
});
