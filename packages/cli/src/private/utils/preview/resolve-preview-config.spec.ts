import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import resolvePreviewConfig from "#utils/preview/resolve-preview-config";
import type { Instructions } from "@liolocs/powerups-sdk";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/preview-config");

const instructions = {
  name: "cfg",
  type: "single-use",
  description: "x",
  variables: { required: ["appName"], optional: ["theme"] },
  intent: [],
  steps: [],
} as unknown as Instructions;

test.case("merges preview.json variables with flag overrides (flags win)", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/preview.json").write(JSON.stringify({
    variables: { appName: "from-file", theme: "dark" },
    exec: "npm run dev",
  }));

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions,
    rawFlags: [{ flag: "--appName", value: "from-flag" }],
  });

  assert(config.variables.appName).equals("from-flag");
  assert(config.variables.theme).equals("dark");
  assert(config.exec).equals("npm run dev");
  assert(config.outputDir).equals("preview");
  assert(config.watch).true();

  await testRoot.remove({ recursive: true });
});

test.case("watch defaults to false without an exec command", async assert => {
  await fs.create(testRoot);

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions,
    rawFlags: [{ flag: "--appName", value: "a" }],
  });

  assert(config.watch).false();

  await testRoot.remove({ recursive: true });
});

test.case("missing required variables throw missing_variables listing them", async assert => {
  await fs.create(testRoot);

  try {
    await resolvePreviewConfig({ powerupRoot: testRoot, instructions, rawFlags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_variables");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("appName");
  }

  await testRoot.remove({ recursive: true });
});

test.case("kebab-case flags normalize to camelCase variables", async assert => {
  await fs.create(testRoot);

  const config = await resolvePreviewConfig({
    powerupRoot: testRoot,
    instructions: { ...instructions, variables: { required: ["myApp"], optional: [] } } as never,
    rawFlags: [{ flag: "--my-app", value: "x" }],
  });

  assert(config.variables.myApp).equals("x");

  await testRoot.remove({ recursive: true });
});

test.case("invalid preview.json throws preview_json_invalid", async assert => {
  await fs.create(testRoot);
  await testRoot.append("/preview.json").write("{ not json");

  try {
    await resolvePreviewConfig({ powerupRoot: testRoot, instructions, rawFlags: [{ flag: "--appName", value: "a" }] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("preview_json_invalid");
  }

  await testRoot.remove({ recursive: true });
});
