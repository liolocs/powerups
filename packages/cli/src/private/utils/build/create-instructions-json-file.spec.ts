import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { getPackageJson } from "#utils/build/getPackageJson";
import { CLI_FOLDER_NAME, INTERNAL_FOLDER, PACKAGE_JSON } from "#constants";
import { BuildErrorCode } from "#errors/buildErrors";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";
import { type Instructions } from "@liolocs/powerups-sdk";
import createInstructionsJSONFile from "#utils/build/create-instructions-json-file";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("should create instructions.json based on the compiled index file", async assert => {
  await setupTestDir();
  const powerupName = "test-powerup";
  const instructions: Instructions = {
    name: powerupName,
    type: "multi-use",
    description: "a test powerup",
    variables: {
      required: ["name"],
      optional: [],
    },
    intent: [
      "create a test component",
    ],
    steps: [
      {
        type: "create",
        name: "component",
        template: "templates/component.ts",
        outputPath: "src/components/{{name}}.ts",
      },
    ],
  };
  await createPowerupPackageForTest({ testRoot, instructions });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );

   const distDirRef = packageDir.append("/dist");

   await fs.create(distDirRef.path);

  await createInstructionsJSONFile({
    validatedCompiledInstructions: instructions,
    outputFolderRef: distDirRef,
  });

  assert(await fs.exists(packageDir.append("/dist/instructions.json"))).true();
  const createdInstructionsJson = await packageDir.append("/dist/instructions.json").json() as Instructions;
  assert(createdInstructionsJson.name).equals(instructions.name);
  assert(createdInstructionsJson.type).equals(instructions.type);
  assert(createdInstructionsJson.description).equals(instructions.description);
  assert(createdInstructionsJson.variables.required).equals(instructions.variables.required);
  assert(createdInstructionsJson.variables.optional).equals([])
  assert(createdInstructionsJson.intent).equals(instructions.intent);
  assert(createdInstructionsJson.steps.length).equals(1);
  assert(createdInstructionsJson.steps[0].type).equals(instructions.steps[0].type);
  assert(createdInstructionsJson.steps[0].name).equals(instructions.steps[0].name);
  assert(createdInstructionsJson.steps[0].template).equals(instructions.steps[0].template);
  assert(createdInstructionsJson.steps[0].outputPath).equals(instructions.steps[0].outputPath);

  await cleanup();
});