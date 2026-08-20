import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { UseErrorCode } from "#errors/useErrors";
import parseModifyTemplate from "#utils/use/run-powerup/steps/run-modify-step/parse-modify-template";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/parse-modify-template-test-powerup");

async function setupTestDir(): Promise<void> {
  await testPowerupDir.remove();
  await fs.create(testPowerupDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("parses a .json modify template directly", async assert => {
  await setupTestDir();

  const templateFile = testPowerupDir.append("/mod.json");
  await fs.write(templateFile, `[{"where":"top","content":"hello"}]`);

  const result = await parseModifyTemplate({
    templatePath: templateFile,
    variables: {},
  });

  assert(result.length).equals(1);
  assert(result[0].where).equals("top");
  assert(result[0].content).equals("hello");

  await cleanup();
});

test.case("renders and parses a .ts modify template with variables", async assert => {
  await setupTestDir();

  const templateFile = testPowerupDir.append("/mod.ts");
  await fs.write(
    templateFile,
    `export default (vars: Record<string, string>) => JSON.stringify([{ where: "top", content: "hello " + vars.name }]);`,
  );

  const result = await parseModifyTemplate({
    templatePath: templateFile,
    variables: { name: "World" },
  });

  assert(result.length).equals(1);
  assert(result[0].where).equals("top");
  assert(result[0].content).equals("hello World");

  await cleanup();
});

test.case("throws modify_template_invalid_json when template output is not valid JSON", async assert => {
  await setupTestDir();

  const templateFile = testPowerupDir.append("/bad-mod.json");
  await fs.write(templateFile, `{not valid json}`);

  await assert(parseModifyTemplate({
    templatePath: templateFile,
    variables: {},
  })).throwsAsync(UseErrorCode.modify_template_invalid_json);

  await cleanup();
});