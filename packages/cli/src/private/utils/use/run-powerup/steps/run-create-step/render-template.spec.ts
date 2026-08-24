import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { UseErrorCode } from "#errors/useErrors";
import renderTemplate from "#utils/use/run-powerup/steps/run-create-step/render-template";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/render-template-test-powerup");

async function setupTestDir(): Promise<void> {
  await testPowerupDir.remove();
  await fs.create(testPowerupDir);
  await fs.create(testPowerupDir.append("/dist"));
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("renders a .ts template with variables successfully", async assert => {
  await setupTestDir();

  const templateFile = testPowerupDir.append("/dist/component.ts");
  await fs.write(templateFile, `export default (vars: Record<string, string>) => \`export const \${vars.name} = "hello";\`;`);

  const result = await renderTemplate({
    template: "component.ts",
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(result).equals(`export const MyComponent = "hello";`);

  await cleanup();
});

test.case("throws template_not_found when template file does not exist", async assert => {
  await setupTestDir();

  await assert(renderTemplate({
    template: "nonexistent.ts",
    powerupDirectory: testPowerupDir,
    variables: { name: "foo" },
  })).throwsAsync(UseErrorCode.template_not_found);

  await cleanup();
});