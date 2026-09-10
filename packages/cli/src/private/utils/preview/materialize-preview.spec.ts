import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import materializePreview from "#utils/preview/materialize-preview";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/materialize");

async function scaffoldPowerup({ powerupRoot }: { powerupRoot: import("@rcompat/fs").FileRef }): Promise<void> {
  await fs.create(powerupRoot);
  await powerupRoot.append("/index.ts").write([
    `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
    ``,
    `const instructions: Instructions = {`,
    `  name: "prev",`,
    `  type: "single-use",`,
    `  description: "x",`,
    `  variables: { required: ["appName"], optional: [] },`,
    `  intent: [],`,
    `  steps: [`,
    `    {`,
    `      "type": "create",`,
    `      "name": "static",`,
    `      "file": "src/create/static.txt",`,
    `      "outputPath": "static.txt"`,
    `    },`,
    `    {`,
    `      "type": "dynamic-create",`,
    `      "name": "dynamic",`,
    `      "template": "src/dynamic-create/dynamic.ts",`,
    `      "outputPath": "dynamic.txt"`,
    `    },`,
    `    {`,
    `      "type": "modify",`,
    `      "name": "patch",`,
    `      "file": "src/modify/config.json.json",`,
    `      "outputPath": "config.json"`,
    `    }`,
    `  ],`,
    `};`,
    ``,
    `export default defineInstructions(instructions, import.meta.url);`,
  ].join("\n"));

  const staticSource = powerupRoot.append("/src/create/static.txt");
  await fs.create(staticSource.directory);
  await staticSource.write("static body\n");

  const dynamicTemplate = powerupRoot.append("/src/dynamic-create/dynamic.ts");
  await fs.create(dynamicTemplate.directory);
  await dynamicTemplate.write(`export default function (_variables: Record<string, string>): string {\n  return \`app=\${_variables.appName}\`;\n}\n`);

  const modifySource = powerupRoot.append("/src/modify/config.json.json");
  await fs.create(modifySource.directory);
  await modifySource.write(JSON.stringify([{ where: "top", content: "{\n  \"patched\": true,\n" }], null, 2));

  const fixture = powerupRoot.append("/fixtures/config.json");
  await fs.create(fixture.directory);
  await fixture.write("{\n  \"existing\": true\n}\n");
}

test.case("materializes fixtures + static + dynamic + modify steps into the preview dir", async assert => {
  const powerupRoot = testRoot.append("/powerup");
  await scaffoldPowerup({ powerupRoot });

  const instructions = await (await import("#utils/preview/load-instructions-from-source")).default({ powerupRoot });

  const result = await materializePreview({
    powerupRoot,
    instructions,
    config: { variables: { appName: "my-app" }, output: "preview", watch: false },
    isFirstMaterialize: true,
  });

  const previewDir = powerupRoot.append("/preview");
  assert(await previewDir.append("/static.txt").text()).equals("static body\n");
  assert(await previewDir.append("/dynamic.txt").text()).equals("app=my-app\n");
  assert(await previewDir.append("/config.json").text()).includes("\"patched\": true");
  assert(await previewDir.append("/config.json").text()).includes("\"existing\": true");

  const manifest = JSON.parse(await previewDir.append("/.preview-manifest.json").text());
  assert(manifest["static.txt"]).equals(result.generatedPaths.includes("static.txt") ? manifest["static.txt"] : "");
  assert(result.generatedPaths.includes("config.json")).true();

  await testRoot.remove({ recursive: true });
});

test.case("second run deletes stale generated files but preserves untracked ones", async assert => {
  const powerupRoot = testRoot.append("/powerup2");
  await scaffoldPowerup({ powerupRoot });

  const load = (await import("#utils/preview/load-instructions-from-source")).default;
  const instructions = await load({ powerupRoot });
  const config = { variables: { appName: "my-app" }, output: "preview", watch: false };

  await materializePreview({ powerupRoot, instructions, config: config as never, isFirstMaterialize: true });

  const previewDir = powerupRoot.append("/preview");
  await previewDir.append("/user-scratch.txt").write("keep me\n");

  // remove the static step (the first step) from index.ts to make static.txt stale.
  // The static block is the first array element, so match it from its opening brace
  // through its closing brace + trailing comma + newline.
  const indexRef = powerupRoot.append("/index.ts");
  await indexRef.write((await indexRef.text()).replace(/    \{\n      "type": "create",\n      "name": "static",[\s\S]*?\n    \},\n/, ""));

  const refreshedInstructions = await load({ powerupRoot });
  const second = await materializePreview({
    powerupRoot,
    instructions: refreshedInstructions,
    config: config as never,
    isFirstMaterialize: false,
  });

  assert(second.stalePaths.includes("static.txt")).true();
  assert(await previewDir.append("/static.txt").exists()).false();
  assert(await previewDir.append("/user-scratch.txt").text()).equals("keep me\n");

  await testRoot.remove({ recursive: true });
});
