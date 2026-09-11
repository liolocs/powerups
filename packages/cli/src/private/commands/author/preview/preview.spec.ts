import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import preview from "#commands/author/preview/index";
import { createSdkDependencyForTest } from "#test-utils/create-powerup-for-test";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-command");

test.case("materializes with variables from flags and exits when no exec command is configured", async assert => {
  await fs.create(testRoot);
  const sdkDependency = await createSdkDependencyForTest({ packageDir: testRoot });
  await testRoot.append("/package.json").writeJSON({
    name: "test-powerup",
    description: "",
    type: "module",
    dependencies: { "@liolocs/powerups-sdk": sdkDependency },
  });
  await testRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "pv",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: ["appName"], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "dynamic-create",`,
    `      "name": "app",`,
    `      "template": "src/dynamic-create/app.ts",`,
    `      "outputPath": "app.txt"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const templateRef = testRoot.append("/src/dynamic-create/app.ts");
  await fs.create(templateRef.directory);
  await templateRef.write(`export default function (_variables: Record<string, string>): string {\n  return \`app=\${_variables.appName}\`;\n}\n`);

  await preview.run({
    subcommands: [],
    flags: [{ flag: "--appName", value: "flag-value" }],
    context: { root: testRoot },
  });

  assert(await testRoot.append("/preview/app.txt").text()).equals("app=flag-value\n");

  const manifest = JSON.parse(await testRoot.append("/preview/.preview-manifest.json").text());

  assert(Object.keys(manifest).includes("app.txt")).true();

  await testRoot.remove({ recursive: true });
});