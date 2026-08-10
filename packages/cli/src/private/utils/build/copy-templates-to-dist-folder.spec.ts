import { CLI_FOLDER_NAME, INTERNAL_FOLDER, PACKAGE_JSON } from "#constants";
import { BuildErrorCode } from "#errors/buildErrors";
import captureStdout from "#test-utils/capture-stdout";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";
import test from "#test-utils/test/index";
import copyTemplatesToDistFolder from "#utils/build/copy-templates-to-dist-folder";
import { type Instructions, type Step } from "@liolocs/powerups-sdk";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

// ---------------------------------------------------------------------------
// Own templates (templates that live in the powerup's own source tree)
// ---------------------------------------------------------------------------

test.case("should copy own templates referenced by steps into the dist folder", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const instructions = await createPowerupPackageForTest({ powerupName, testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );
  const distFileRef = packageDir.append("/dist");
  await fs.create(distFileRef.path);

  await copyTemplatesToDistFolder({
    instructionSteps: instructions.steps,
    cwd: packageDir,
    distFileRef,
    sourceFromCompiledInstructions: `${packageDir.path}/dist/index.js`,
    powerupName,
  });

  const copiedTemplate = distFileRef.append("/templates/component.ts");
  assert(await fs.exists(copiedTemplate)).true();

  const source = await packageDir.append("/templates/component.ts").text();
  const copy = await copiedTemplate.text();
  assert(copy).equals(source);

  await cleanup();
});

test.case("should throw template_not_found when an own template does not exist", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const instructions: Instructions = {
    name: powerupName,
    type: "multi-use",
    description: "a test powerup",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "create",
        name: "component",
        template: "templates/missing.ts",
        outputPath: "src/components/{{name}}.ts",
      },
    ],
  };
  await createPowerupPackageForTest({ powerupName, testRoot, instructions });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );
  const distFileRef = packageDir.append("/dist");
  await fs.create(distFileRef.path);

  await assert(
    copyTemplatesToDistFolder({
      instructionSteps: instructions.steps,
      cwd: packageDir,
      distFileRef,
      sourceFromCompiledInstructions: `${packageDir.path}/dist/index.js`,
      powerupName,
    }),
  ).throwsAsync(BuildErrorCode.template_not_found);

  await cleanup();
});

test.case("should skip steps that do not declare a template", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const instructions: Instructions = {
    name: powerupName,
    type: "multi-use",
    description: "a test powerup",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "create",
        name: "component",
        template: "templates/component.ts",
        outputPath: "src/components/{{name}}.ts",
      },
      {
        type: "delete",
        name: "component",
        outputPath: "src/old.ts",
      },
      {
        type: "install",
        name: "component",
        dependencies: ["lodash"],
      },
    ],
  };
  await createPowerupPackageForTest({ powerupName, testRoot, instructions });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );
  const distFileRef = packageDir.append("/dist");
  await fs.create(distFileRef.path);

  await assert(
    copyTemplatesToDistFolder({
      instructionSteps: instructions.steps,
      cwd: packageDir,
      distFileRef,
      sourceFromCompiledInstructions: `${packageDir.path}/dist/index.js`,
      powerupName,
    }),
  ).noErrorAsync();

  await cleanup();
});

test.case("should only copy each own template once when referenced by multiple steps", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const instructions: Instructions = {
    name: powerupName,
    type: "multi-use",
    description: "a test powerup",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "create",
        name: "component-a-uses-same-template",
        template: "templates/component.ts",
        outputPath: "src/some-path/{{name}}.ts",
      },
      {
        type: "modify",
        name: "component-b-uses-same-template",
        template: "templates/component.ts",
        outputPath: "src/some-other-path/{{name}}.ts",
      },
    ],
  };
  await createPowerupPackageForTest({ powerupName, testRoot, instructions });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );
  const distFileRef = packageDir.append("/dist");
  await fs.create(distFileRef.path);

  await copyTemplatesToDistFolder({
    instructionSteps: instructions.steps,
    cwd: packageDir,
    distFileRef,
    sourceFromCompiledInstructions: `${packageDir.path}/dist/index.js`,
    powerupName,
  });

  // The template is copied once and remains identical to the source.
  const copiedTemplate = distFileRef.append("/templates/component.ts");
  assert(await fs.exists(copiedTemplate)).true();
  assert(await copiedTemplate.text()).equals(
    await packageDir.append("/templates/component.ts").text(),
  );

  await cleanup();
});

// ---------------------------------------------------------------------------
// Internal (child) templates — templates prefixed with `_internal/`
// ---------------------------------------------------------------------------

test.case("should copy internal templates from a built child package's dist folder", async assert => {
  await setupTestDir();
  const parentName = "parent-powerup";
  const childName = "child-powerup";
  await createPowerupPackageForTest({ powerupName: parentName, testRoot });

  // Simulate a built child package: package.json + dist/templates/component.ts
  const childPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${childName}`,
  );
  await fs.create(childPackageDir.append("/dist/templates"));
  await childPackageDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: childName,
    version: "1.0.0",
    keywords: ["powerups-package"],
  });
  const childTemplateContent = "export default () => 'child template';\n";
  await childPackageDir.append("/dist/templates/component.ts").write(childTemplateContent);

  const parentPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${parentName}`,
  );
  const distFileRef = parentPackageDir.append("/dist");
  await fs.create(distFileRef.path);

  const childSource = `${childPackageDir.path}/dist/index.js`;

  const steps: Step[] = [
    {
      type: "create",
      name: "child:component",
      template: `_internal/${childName}/templates/component.ts`,
      outputPath: "src/components/{{name}}.ts",
      __source: childSource,
    } as Step,
  ];

  await copyTemplatesToDistFolder({
    instructionSteps: steps,
    cwd: parentPackageDir,
    distFileRef,
    sourceFromCompiledInstructions: `${parentPackageDir.path}/dist/index.js`,
    powerupName: parentName,
  });

  const copiedTemplate = distFileRef.append(`/_internal/${childName}/templates/component.ts`);
  assert(await fs.exists(copiedTemplate)).true();
  assert(await copiedTemplate.text()).equals(childTemplateContent);

  await cleanup();
});

test.case("should resolve the child source from sourceFromCompiledInstructions when __source is absent", async assert => {
  await setupTestDir();
  const parentName = "parent-powerup";
  const childName = "child-powerup";
  await createPowerupPackageForTest({ powerupName: parentName, testRoot });

  const childPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${childName}`,
  );
  await fs.create(childPackageDir.append("/dist/templates"));
  await childPackageDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: childName,
    version: "1.0.0",
    keywords: ["powerups-package"],
  });
  const childTemplateContent = "export default () => 'child template';\n";
  await childPackageDir.append("/dist/templates/component.ts").write(childTemplateContent);

  const parentPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${parentName}`,
  );
  const distFileRef = parentPackageDir.append("/dist");
  await fs.create(distFileRef.path);

  // No __source on the step — falls back to sourceFromCompiledInstructions.
  const childSource = `${childPackageDir.path}/dist/index.js`;
  const steps: Step[] = [
    {
      type: "create",
      name: "child:component",
      template: `_internal/${childName}/templates/component.ts`,
      outputPath: "src/components/{{name}}.ts",
    } as Step,
  ];

  await copyTemplatesToDistFolder({
    instructionSteps: steps,
    cwd: parentPackageDir,
    distFileRef,
    sourceFromCompiledInstructions: childSource,
    powerupName: parentName,
  });

  const copiedTemplate = distFileRef.append(`/_internal/${childName}/templates/component.ts`);
  assert(await fs.exists(copiedTemplate)).true();
  assert(await copiedTemplate.text()).equals(childTemplateContent);

  await cleanup();
});

test.case("should throw child_not_built when the child package dist template is missing", async assert => {
  await setupTestDir();
  const parentName = "parent-powerup";
  const childName = "child-powerup";
  await createPowerupPackageForTest({ powerupName: parentName, testRoot });

  // Child package exists with a package.json but its dist template was never built.
  const childPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${childName}`,
  );
  await fs.create(childPackageDir.append("/dist"));
  await childPackageDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: childName,
    version: "1.0.0",
    keywords: ["powerups-package"],
  });

  const parentPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${parentName}`,
  );
  const distFileRef = parentPackageDir.append("/dist");
  await fs.create(distFileRef.path);

  const childSource = `${childPackageDir.path}/dist/index.js`;
  const steps: Step[] = [
    {
      type: "create",
      name: "child:component",
      template: `_internal/${childName}/templates/component.ts`,
      outputPath: "src/components/{{name}}.ts",
      __source: childSource,
    } as Step,
  ];

  await assert(
    copyTemplatesToDistFolder({
      instructionSteps: steps,
      cwd: parentPackageDir,
      distFileRef,
      sourceFromCompiledInstructions: `${parentPackageDir.path}/dist/index.js`,
      powerupName: parentName,
    }),
  ).throwsAsync(BuildErrorCode.child_not_built);

  await cleanup();
});

test.case("should only copy each internal template once when referenced by multiple steps", async assert => {
  await setupTestDir();
  const parentName = "parent-powerup";
  const childName = "child-powerup";
  await createPowerupPackageForTest({ powerupName: parentName, testRoot });

  const childPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${childName}`,
  );
  await fs.create(childPackageDir.append("/dist/templates"));
  await childPackageDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: childName,
    version: "1.0.0",
    keywords: ["powerups-package"],
  });
  const childTemplateContent = "export default () => 'child template';\n";
  await childPackageDir.append("/dist/templates/component.ts").write(childTemplateContent);

  const parentPackageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${parentName}`,
  );
  const distFileRef = parentPackageDir.append("/dist");
  await fs.create(distFileRef.path);

  const childSource = `${childPackageDir.path}/dist/index.js`;
  const steps: Step[] = [
    {
      type: "create",
      name: "child:component-a",
      template: `_internal/${childName}/templates/component.ts`,
      outputPath: "src/a/{{name}}.ts",
      __source: childSource,
    } as Step,
    {
      type: "modify",
      name: "child:component-b",
      template: `_internal/${childName}/templates/component.ts`,
      outputPath: "src/b/{{name}}.ts",
      __source: childSource,
    } as Step,
  ];

  await copyTemplatesToDistFolder({
    instructionSteps: steps,
    cwd: parentPackageDir,
    distFileRef,
    sourceFromCompiledInstructions: `${parentPackageDir.path}/dist/index.js`,
    powerupName: parentName,
  });

  const copiedTemplate = distFileRef.append(`/_internal/${childName}/templates/component.ts`);
  assert(await fs.exists(copiedTemplate)).true();
  assert(await copiedTemplate.text()).equals(childTemplateContent);

  await cleanup();
});

test.case("should print the powerup name in the success message", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  await createPowerupPackageForTest({ powerupName, testRoot });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );
  const distFileRef = packageDir.append("/dist");
  await fs.create(distFileRef.path);

  const steps: Step[] = [
    {
      type: "create",
      name: "component",
      template: "templates/component.ts",
      outputPath: "src/components/{{name}}.ts",
    } as Step,
  ];

  const output = await captureStdout(() =>
    copyTemplatesToDistFolder({
      instructionSteps: steps,
      cwd: packageDir,
      distFileRef,
      sourceFromCompiledInstructions: `${packageDir.path}/dist/index.js`,
      powerupName: "my-custom-powerup",
    }),
  );

  assert(output.includes("Built powerup: my-custom-powerup")).true();
  assert(output.includes(`${distFileRef.path}`)).true();

  await cleanup();
});