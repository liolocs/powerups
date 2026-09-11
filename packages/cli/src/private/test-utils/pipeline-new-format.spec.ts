import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import build from "#commands/author/build/index";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import { createPowerupPackageForTest } from "#test-utils/create-powerup-for-test";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/pipeline-new-format");

test.case("build + use pipeline works end to end with static and dynamic steps", async assert => {
  await fs.create(testRoot);

  const powerupName = "sample-powerup";
  const instructions = {
    name: powerupName,
    type: "multi-use",
    description: "sample",
    variables: { required: ["name"], optional: [] },
    intent: [],
    steps: [
      { type: "create", name: "static-file", file: "src/create/static.txt", outputPath: "static.txt" },
      {
        type: "dynamic-create",
        name: "dynamic-file",
        template: "src/dynamic-create/dynamic.ts",
        outputPath: "dynamic.txt",
      },
    ],
  };

  await createPowerupPackageForTest({
    powerupName,
    testRoot,
    instructions: instructions as never,
    templates: [{
      name: "dynamic",
      templatePath: "/src/dynamic-create/dynamic.ts",
      content: `export default function (variables: Record<string, string>): string {\n  const { name } = variables;\n  return \`hello \${name}\`;\n}\n`,
    }],
  });

  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );

  // createPowerupPackageForTest only scaffolds src/dynamic-create; write the static source too.
  const staticSource = packageDir.append("/src/create/static.txt");
  await fs.create(staticSource.directory);
  await staticSource.write("static content\n");

  await build.run({ subcommands: [], flags: [], context: { root: packageDir } });

  assert(await packageDir.append("/dist/src/create/static.txt").exists()).true();
  assert(await packageDir.append("/dist/src/dynamic-create/dynamic.ts").exists()).true();

  const use = await import("#utils/use/run-powerup/index");
  const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(
    JSON.parse(await packageDir.append("/dist/instructions.json").text()),
  );

  const destination = testRoot.append("/used");
  await fs.create(destination);

  await use.default({
    destination,
    powerupDirectory: packageDir,
    sourceBase: packageDir.append("/dist"),
    instructions: validatedCompiledInstructions,
    isDryRun: false,
    variables: { name: "world" },
    powerupVersion: "1.0.0",
    powerupLocation: packageDir.path,
    printFinalSummary: false,
  });

  // @rcompat/fs enforces a trailing newline on text writes, so both rendered
  // and verbatim-copied files end with "\n".
  assert(await destination.append("/static.txt").text()).equals("static content\n");
  assert(await destination.append("/dynamic.txt").text()).equals("hello world\n");

  await testRoot.remove({ recursive: true });
});
