import test from "@rcompat/test";
import createCreateCommand from "#commands/output/create/index";
import { instructionsSchema } from "#schemas/instruction";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import { OutputTemplateCreateErrorCode } from "#errors/outputCreateErrors";
import { MAIN_FOLDER, OUTPUT_FOLDER, TEMPLATE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const templateFolder = mainFolder.append(`/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

const create = createCreateCommand("template");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

test.case("create template creates an instructions.json file", async assert => {
  await reset();

  await create.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "test-template" },
      { flag: "--description", value: "test description" },],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/test-template/instructions.json");
  const hasOutput = await fs.exists(outputPath);
  assert(hasOutput).equals(true);

  await testRoot.remove();
});

test.case("create template creates empty files for create and modify entries", async assert => {
  await reset();

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
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "component,ui" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: output },
    ],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/ui-component/instructions.json");
  const createTemplatePath = templateFolder.append("/ui-component/button.svelte.tmpl");
  const modifyTemplatePath = templateFolder.append("/ui-component/wire.json");

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
  // Generated outputs do not include the optional "includes" field
  assert(content.includes).undefined();

  await testRoot.remove();
});

test.case("create template with -p flag writes packageDependencies to instructions.json", async assert => {
  await reset();

  const packageDeps = JSON.stringify([
    { target: "packages/web", dependencies: ["react@^18.0.0"] },
  ]);

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "with-deps" },
      { flag: "--description", value: "test description" },
      { flag: "--package-deps", value: packageDeps },
    ],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/with-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).defined();
  assert(content.packageDependencies!.length).equals(1);
  assert(content.packageDependencies![0].target).equals("packages/web");
  assert(content.packageDependencies![0].dependencies![0]).equals("react@^18.0.0");

  await testRoot.remove();
});

test.case("create template without -p flag omits packageDependencies", async assert => {
  await reset();

  await create.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "no-deps" },
      { flag: "--description", value: "test description" },],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/no-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).undefined();

  await testRoot.remove();
});

test.group("create errors", () => {
  test.case("should fail with dry_folder_not_found without .saved folder", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "should-fail" },
      { flag: "--description", value: "test description" },],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateCreateErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with already_exists when template name is taken", async assert => {
    await reset();

    await create.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "dup-template" },
      { flag: "--description", value: "test description" },],
      context: { root: testRoot },
    });

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "dup-template" },
      { flag: "--description", value: "test description" },],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateCreateErrorCode.already_exists);

    await testRoot.remove();
  });

  test.case("should fail with invalid_package_deps_json when --package-deps is malformed", async assert => {
    await reset();

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
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
    assert(threw).equals(OutputTemplateCreateErrorCode.invalid_package_deps_json);

    await testRoot.remove();
  });

  test.case("should fail with invalid_output_json when --output is malformed", async assert => {
    await reset();

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
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
    assert(threw).equals(OutputTemplateCreateErrorCode.invalid_output_json);

    await testRoot.remove();
  });
});
test.case("should write optional variables when --optional-variables flag is provided", async assert => {
  await reset();

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "opt-template" },
      { flag: "--description", value: "test description" },
      { flag: "--variables", value: "name" },
      { flag: "--optional-variables", value: "sub,subDescription" },
    ],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/opt-template/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).equals(["sub", "subDescription"]);

  await testRoot.remove();
});

test.case("should omit optional from JSON when --optional-variables is not provided", async assert => {
  await reset();

  await create.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "no-opt" },
      { flag: "--description", value: "test description" },
      { flag: "--variables", value: "name" },
    ],
    context: { root: testRoot },
  });

  const outputPath = templateFolder.append("/no-opt/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).undefined();

  await testRoot.remove();
});
