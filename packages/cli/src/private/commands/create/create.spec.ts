import test from "@rcompat/test";
import create from "#commands/create/index";
import { instructionsSchema } from "#schemas/instruction";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import { CreateErrorCode } from "#errors/createErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CONFIG_FILE,
  SINGULAR_NAME,
  CLI_NAME,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const internalFolder = mainFolder.append(`/${INTERNAL_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(internalFolder);
}

async function createTestPackage(name: string) {
  const pkgDir = internalFolder.append(`/${name}`);
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name,
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    powerups: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
  });
}

function pkgMultiUse(pkgName: string) {
  return internalFolder.append(`/${pkgName}/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);
}

test.case("create template creates an instructions.json file", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "test-template" },
      { flag: "--description", value: "test description" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/test-template/instructions.json");
  const hasOutput = await fs.exists(outputPath);
  assert(hasOutput).equals(true);

  await testRoot.remove();
});

test.case("create template creates empty files for create and modify entries", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  const output = JSON.stringify({
    create: [{
      name: "button.svelte",
      template: "button.svelte.tmpl",
      outputPath: "src/{{ComponentName}}.svelte",
    }],
    modify: [{
      name: "wire",
      template: "wire.json",
      outputPath: "src/index.ts",
    }],
  });

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "component,ui" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: output },
    ],
    context: { root: testRoot },
  });

  const muFolder = pkgMultiUse("test-pkg");
  const outputPath = muFolder.append("/ui-component/instructions.json");
  const createTemplatePath = muFolder.append("/ui-component/template/button.svelte.tmpl");
  const modifyTemplatePath = muFolder.append("/ui-component/template/wire.json");

  assert(await fs.exists(outputPath)).equals(true);
  assert(await fs.exists(createTemplatePath)).equals(true);
  assert(await fs.exists(modifyTemplatePath)).equals(true);

  const content = instructionsSchema.parse(await outputPath.json());

  assert(content.name).equals("ui-component");
  assert(content.intent).equals(["component", "ui"]);
  assert(content.variables.required).equals(["ComponentName"]);
  assert(content.variables.optional).undefined();
  assert(content.output.create[0]?.name).equals("button.svelte");
  assert(content.output.modify[0]?.name).equals("wire");
  assert(content.includes).undefined();

  await testRoot.remove();
});

test.case("create template with -p flag writes packageDependencies to instructions.json", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  const packageDeps = JSON.stringify([
    { target: "packages/web", dependencies: ["react@^18.0.0"] },
  ]);

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "with-deps" },
      { flag: "--description", value: "test description" },
      { flag: "--package-deps", value: packageDeps },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/with-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).defined();
  assert(content.packageDependencies!.length).equals(1);
  assert(content.packageDependencies![0].target).equals("packages/web");
  assert(content.packageDependencies![0].dependencies![0]).equals("react@^18.0.0");

  await testRoot.remove();
});

test.case("create template without -p flag omits packageDependencies", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "no-deps" },
      { flag: "--description", value: "test description" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/no-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).undefined();

  await testRoot.remove();
});

test.group("create errors", () => {
  test.case(`should fail with dry_folder_not_found without ${MAIN_FOLDER} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "test-pkg" },
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "should-fail" },
          { flag: "--description", value: "test description" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with already_exists when template name is taken", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    await create.run({
      subcommands: [],
      flags: [
        { flag: "--pack", value: "test-pkg" },
        { flag: "--type", value: "multi-use" },
        { flag: "--name", value: "dup-template" },
        { flag: "--description", value: "test description" },
      ],
      context: { root: testRoot },
    });

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "test-pkg" },
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "dup-template" },
          { flag: "--description", value: "test description" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.already_exists);

    await testRoot.remove();
  });

  test.case("should fail with missing_pack when --pack not provided", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "test" },
          { flag: "--description", value: "test" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.missing_pack);

    await testRoot.remove();
  });

  test.case("should fail with pack_not_found when package doesn't exist", async assert => {
    await reset();

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "missing-pkg" },
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "test" },
          { flag: "--description", value: "test" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.pack_not_found);

    await testRoot.remove();
  });

  test.case("should fail with invalid_package_deps_json when --package-deps is malformed", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "test-pkg" },
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "bad-deps" },
          { flag: "--description", value: "test description" },
          { flag: "--package-deps", value: "{not valid json" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.invalid_package_deps_json);

    await testRoot.remove();
  });

  test.case("should fail with invalid_output_json when --output is malformed", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "test-pkg" },
          { flag: "--type", value: "multi-use" },
          { flag: "--name", value: "bad-json" },
          { flag: "--description", value: "test description" },
          { flag: "--output", value: "{not valid json" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.invalid_output_json);

    await testRoot.remove();
  });
});

test.case("should write optional variables when --optional-variables flag is provided", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "opt-template" },
      { flag: "--description", value: "test description" },
      { flag: "--variables", value: "name" },
      { flag: "--optional-variables", value: "sub,subDescription" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/opt-template/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).equals(["sub", "subDescription"]);

  await testRoot.remove();
});

test.case("should omit optional from JSON when --optional-variables is not provided", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "no-opt" },
      { flag: "--description", value: "test description" },
      { flag: "--variables", value: "name" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/no-opt/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).undefined();

  await testRoot.remove();
});

test.case(`should update package.json ${CLI_NAME} property after creating a ${SINGULAR_NAME}`, async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "test-powerup" },
      { flag: "--description", value: "test" },
    ],
    context: { root: testRoot },
  });

  const pkgJson = await internalFolder
    .append(`/test-pkg/${PACKAGE_FILE}`)
    .json() as Record<string, unknown>;
  const powerups = (pkgJson.powerups as Record<string, Record<string, Record<string, string[]>>>).active;
  assert(powerups[MULTI_USE_FOLDER]["test-powerup"]).defined();

  await testRoot.remove();
});

test.case(`should add package to project config after creating a ${SINGULAR_NAME}`, async assert => {
  await reset();
  await createTestPackage("test-pkg");
  await mainFolder.append(`/${CONFIG_FILE}`).writeJSON({ harness: "claude", packages: [] });

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: "test-powerup" },
      { flag: "--description", value: "test" },
    ],
    context: { root: testRoot },
  });

  const config = await mainFolder.append(`/${CONFIG_FILE}`).json() as Record<string, unknown>;
  assert(config.packages).equals(["test-pkg"]);

  await testRoot.remove();
});