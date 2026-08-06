import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import { buildPowerup } from "#commands/build/index";
import { BuildErrorCode } from "#errors/buildErrors";
import { KEYWORD_PACKAGE } from "#constants";

const root = await runtime.projectRoot();
const baseTmpDir = root.append("/.test-build-tmp");

let counter = 0;

async function setupPowerup(files: Record<string, string>): Promise<import("@rcompat/fs").FileRef> {
  const tmpDir = baseTmpDir.append(`/${counter++}`);
  await fs.create(tmpDir);
  for (const [path, content] of Object.entries(files)) {
    const ref = tmpDir.append(`/${path}`);
    await ref.directory.create();
    await ref.write(content);
  }
  return tmpDir;
}

async function teardownAll() {
  if (await fs.exists(baseTmpDir)) {
    await baseTmpDir.remove({ recursive: true });
  }
}

const validInstructionsTs =
  `export default () => ({\n` +
  `  name: "test-powerup",\n` +
  `  type: "single-use",\n` +
  `  description: "A test powerup",\n` +
  `  variables: { required: [] },\n` +
  `  intent: [],\n` +
  `  steps: [\n` +
  `    { type: "create", name: "comp", template: "template/comp.ts.ts", outputPath: "src/comp.ts" },\n` +
  `  ],\n` +
  `});\n`;

const validPackageJson = JSON.stringify({
  name: "test-powerup",
  version: "1.0.0",
  description: "A test powerup",
  keywords: [KEYWORD_PACKAGE],
  powerup: { instructions: "index.ts" },
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test.group("build (success)", () => {
  test.case("builds a valid powerup with templates", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      "template/comp.ts.ts": "export const comp = 1;\n",
    });

    await buildPowerup(tmpDir);

    // instructions.json exists
    const instructionsRef = tmpDir.append("/dist/instructions.json");
    assert(await fs.exists(instructionsRef)).true();

    // instructions.json content
    const instructions = await instructionsRef.json() as Record<string, unknown>;
    assert(instructions.name).equals("test-powerup");
    assert(instructions.type).equals("single-use");
    const steps = instructions.steps as unknown[];
    assert(steps.length).equals(1);

    // template copied
    const templateRef = tmpDir.append("/dist/template/comp.ts.ts");
    assert(await fs.exists(templateRef)).true();

    await teardownAll();
  });

  test.case("copies read step templates but not raw/jsonPath reads", async assert => {
    await teardownAll();
    const instructionsTs =
      `export default () => ({\n` +
      `  name: "test-powerup",\n` +
      `  type: "single-use",\n` +
      `  description: "A test powerup",\n` +
      `  variables: { required: [] },\n` +
      `  intent: [],\n` +
      `  steps: [\n` +
      `    { type: "read", name: "r1", path: "package.json", as: "name", jsonPath: "name" },\n` +
      `    { type: "read", name: "r2", path: "README.md", as: "text", template: "template/extract.ts.ts" },\n` +
      `  ],\n` +
      `});\n`;

    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": instructionsTs,
      "template/extract.ts.ts": "export default () => 'extracted';\n",
    });

    await buildPowerup(tmpDir);

    // Template from read step should be copied
    const templateRef = tmpDir.append("/dist/template/extract.ts.ts");
    assert(await fs.exists(templateRef)).true();

    // No package.json or README.md copied (they are read targets, not templates)
    assert(await fs.exists(tmpDir.append("/dist/package.json"))).false();

    await teardownAll();
  });

  test.case("clean rebuild removes stale files", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      "template/comp.ts.ts": "export const comp = 1;\n",
    });

    // First build
    await buildPowerup(tmpDir);

    // Add a stale file in dist
    await tmpDir.append("/dist/stale.txt").write("stale");

    // Second build
    await buildPowerup(tmpDir);

    // Stale file should be gone
    assert(await fs.exists(tmpDir.append("/dist/stale.txt"))).false();

    // instructions.json should still be there
    assert(await fs.exists(tmpDir.append("/dist/instructions.json"))).true();

    await teardownAll();
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

test.group("build (errors)", () => {
  test.case("errors when no package.json exists", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({});

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.no_package_json);

    await teardownAll();
  });

  test.case("errors when keywords is missing powerups-package", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": JSON.stringify({
        name: "not-a-powerup",
        version: "1.0.0",
        keywords: ["something-else"],
        powerup: { instructions: "index.ts" },
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.not_a_powerups_package);

    await teardownAll();
  });

  test.case("errors on old string powerup format", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": JSON.stringify({
        name: "old-format",
        version: "1.0.0",
        keywords: [KEYWORD_PACKAGE],
        powerup: "./instructions.json",
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_powerup_property);

    await teardownAll();
  });

  test.case("errors when instructions field is missing", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": JSON.stringify({
        name: "no-instructions",
        version: "1.0.0",
        keywords: [KEYWORD_PACKAGE],
        powerup: { compatibility: {} },
      }),
      "index.ts": validInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_powerup_property);

    await teardownAll();
  });

  test.case("errors when TS file has no default function", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": "export const notDefault = () => ({});\n",
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.invalid_instructions_file);

    await teardownAll();
  });

  test.case("errors when instructions object is malformed", async assert => {
    await teardownAll();
    const badInstructionsTs =
      `export default () => ({\n` +
      `  name: "bad-powerup",\n` +
      `  type: "single-use",\n` +
      `  description: "Missing steps",\n` +
      `  variables: { required: [] },\n` +
      `  intent: [],\n` +
      `});\n`;

    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": badInstructionsTs,
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.malformed_instructions);

    await teardownAll();
  });

  test.case("errors when a referenced template does not exist", async assert => {
    await teardownAll();
    const tmpDir = await setupPowerup({
      "package.json": validPackageJson,
      "index.ts": validInstructionsTs,
      // template/comp.ts.ts is intentionally missing
    });

    let code: string | undefined;
    try {
      await buildPowerup(tmpDir);
    } catch (e) {
      assert(e instanceof CodeError).true();
      code = (e as CodeError).code;
    }
    assert(code).equals(BuildErrorCode.template_not_found);

    await teardownAll();
  });
});