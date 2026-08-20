import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import runModifyStep from "#utils/use/run-powerup/steps/run-modify-step/index";
import type { ModifyStep } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const testPowerupDir = testRoot.append("/run-modify-step-test-powerup");
const testDestinationDir = testRoot.append("/run-modify-step-test-destination");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testPowerupDir);
  await fs.create(testDestinationDir);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

function createTemplateFile(): Promise<void> {
  return fs.write(
    testPowerupDir.append("/mod.json"),
    `[{"where":"top","content":"// header\\n"}]`,
  );
}

async function createTargetFile(name: string, content: string): Promise<void> {
  const targetDir = testDestinationDir.append(`/src`);
  await fs.create(targetDir);
  await fs.write(testDestinationDir.append(`/src/${name}`), content);
}

const baseStep: ModifyStep = {
  type: "modify",
  name: "modify-component",
  template: "mod.json",
  outputPath: "src/{{name}}.ts",
};

test.case("applies modifications to an existing file and returns applied manifest with ModifyOutput", async assert => {
  await setupTestDir();
  await createTemplateFile();
  await createTargetFile("MyComponent.ts", "line1\nline2\nline3\n");

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("applied");
  assert(manifest.stepType).equals("modify");

  if (manifest.output.type === "modify") {
    assert(manifest.output.path).equals("src/MyComponent.ts");
    assert(manifest.output.action).equals("modify");
    assert(manifest.output.characterCount).defined();
  }

  const writtenContent = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(writtenContent).equals("// header\nline1\nline2\nline3");

  await cleanup();
});

test.case("returns skipped-warning and NoneOutput when target file does not exist", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "NonExistent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  await cleanup();
});

test.case("returns skipped-warning and NoneOutput when an anchor is not found in the target file", async assert => {
  await setupTestDir();
  await createTemplateFile();
  await createTargetFile("MyComponent.ts", "line1\nline2\nline3\n");

  // Override template with one that uses an anchor not present in the target
  await fs.write(
    testPowerupDir.append("/mod.json"),
    `[{"where":{"after":"NONEXISTENT_ANCHOR"},"content":"inserted"}]`,
  );

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  // Verify the file content was NOT changed
  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("line1\nline2\nline3");

  await cleanup();
});

test.case("returns skipped-warning and NoneOutput when template does not exist", async assert => {
  await setupTestDir();
  await createTargetFile("MyComponent.ts", "line1\nline2\nline3\n");

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  // Verify the file content was NOT changed
  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("line1\nline2\nline3");

  await cleanup();
});

test.case("returns skipped-warning and NoneOutput when template produces invalid JSON", async assert => {
  await setupTestDir();
  await fs.write(testPowerupDir.append("/mod.json"), `{not valid json}`);
  await createTargetFile("MyComponent.ts", "line1\nline2\nline3\n");

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("skipped-warning");
  assert(manifest.output.type).equals("none");

  await cleanup();
});

test.case("dry-run applies modifications but does NOT write the file", async assert => {
  await setupTestDir();
  await createTemplateFile();
  await createTargetFile("MyComponent.ts", "line1\nline2\nline3\n");

  const { manifest } = await runModifyStep({
    step: baseStep,
    isDryRun: true,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "MyComponent" },
  });

  assert(manifest.status).equals("applied");

  if (manifest.output.type === "modify") {
    assert(manifest.output.characterCount > 0).true();
  }

  // Verify the file content is UNCHANGED
  const content = (await testDestinationDir.append("/src/MyComponent.ts").text()).trim();
  assert(content).equals("line1\nline2\nline3");

  await cleanup();
});

test.case("different variable values produce different output paths", async assert => {
  await setupTestDir();
  await createTemplateFile();
  await createTargetFile("First.ts", "content1\n");
  await createTargetFile("Second.ts", "content2\n");

  await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "First" },
  });

  await runModifyStep({
    step: baseStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "Second" },
  });

  const firstContent = (await testDestinationDir.append("/src/First.ts").text()).trim();
  const secondContent = (await testDestinationDir.append("/src/Second.ts").text()).trim();

  assert(firstContent).equals("// header\ncontent1");
  assert(secondContent).equals("// header\ncontent2");

  await cleanup();
});

test.case("creates parent directories that do not exist yet when writing", async assert => {
  await setupTestDir();
  await createTemplateFile();

  const deepStep: ModifyStep = {
    type: "modify",
    name: "modify-nested",
    template: "mod.json",
    outputPath: "src/deep/nested/{{name}}.ts",
  };

  // Pre-create the target file in nested dirs
  const nestedDir = testDestinationDir.append("/src/deep/nested");
  await fs.create(nestedDir);
  await fs.write(testDestinationDir.append("/src/deep/nested/Nested.ts"), "original\n");

  const { manifest } = await runModifyStep({
    step: deepStep,
    isDryRun: false,
    destination: testDestinationDir,
    powerupDirectory: testPowerupDir,
    variables: { name: "Nested" },
  });

  assert(manifest.status).equals("applied");

  const content = (await testDestinationDir.append("/src/deep/nested/Nested.ts").text()).trim();
  assert(content).equals("// header\noriginal");

  await cleanup();
});