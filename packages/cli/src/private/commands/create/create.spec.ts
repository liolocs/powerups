import test from "@rcompat/test";
import create from "#commands/create/index";
import { instructionsSchema } from "#schemas/instruction";
import { extractPackageDependencies } from "#utils/create/create-powerup";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import { CreateErrorCode } from "#errors/createErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CONFIG_FILE,
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
  await fs.create(pkgDir.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(pkgDir.append(`/${SINGLE_USE_FOLDER}`));
  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name,
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    powerups: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
  });
}

function pkgSingleUse(pkgName: string) {
  return internalFolder.append(`/${pkgName}/${SINGLE_USE_FOLDER}`);
}

function pkgMultiUse(pkgName: string) {
  return internalFolder.append(`/${pkgName}/${MULTI_USE_FOLDER}`);
}

test.case("create with positional name creates an instructions.json file", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["test-template"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgSingleUse("test-pkg").append("/test-template/instructions.json");
  const hasOutput = await fs.exists(outputPath);
  assert(hasOutput).equals(true);

  await testRoot.remove();
});

test.case("create with --type=multi-use creates in multi-use folder", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["ui-component"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--description", value: "test description" },
      { flag: "--intent", value: "component,ui" },
      { flag: "--variables", value: "ComponentName" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgMultiUse("test-pkg").append("/ui-component/instructions.json");
  assert(await fs.exists(outputPath)).true();

  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.name).equals("ui-component");
  assert(content.intent).equals(["component", "ui"]);
  assert(content.variables.required).equals(["ComponentName"]);
  assert(content.variables.optional).undefined();
  assert(content.steps.length).equals(0);

  await testRoot.remove();
});

test.case("create with -p flag writes packageDependencies to instructions.json", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  const packageDeps = JSON.stringify([
    { target: "packages/web", dependencies: ["react@^18.0.0"] },
  ]);

  await create.run({
    subcommands: ["with-deps"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--package-deps", value: packageDeps },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgSingleUse("test-pkg").append("/with-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).defined();
  assert(content.packageDependencies!.length).equals(1);
  assert(content.packageDependencies![0].target).equals("packages/web");
  assert(content.packageDependencies![0].dependencies![0]).equals("react@^18.0.0");

  await testRoot.remove();
});

test.case("create without -p flag omits packageDependencies", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["no-deps"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgSingleUse("test-pkg").append("/no-deps/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.packageDependencies).undefined();

  await testRoot.remove();
});

test.group("create errors", () => {
  test.case(`should fail with main_folder_not_found without ${MAIN_FOLDER} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await create.run({
        subcommands: ["should-fail"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.main_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with already_exists when template name is taken", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    await create.run({
      subcommands: ["dup-template"],
      flags: [
        { flag: "--pack", value: "test-pkg" },
      ],
      context: { root: testRoot },
    });

    let threw;
    try {
      await create.run({
        subcommands: ["dup-template"],
        flags: [
          { flag: "--pack", value: "test-pkg" },
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

  test.case("should fail with missing_name when no name provided", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: [],
        flags: [
          { flag: "--pack", value: "test-pkg" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.missing_name);

    await testRoot.remove();
  });

  test.case("should fail with invalid_package_deps_json when --package-deps is malformed", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: ["bad-deps"],
        flags: [
          { flag: "--pack", value: "test-pkg" },
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

  test.case("should fail with missing_type when --type is invalid", async assert => {
    await reset();
    await createTestPackage("test-pkg");

    let threw;
    try {
      await create.run({
        subcommands: ["bad-type"],
        flags: [
          { flag: "--pack", value: "test-pkg" },
          { flag: "--type", value: "invalid" },
        ],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(CreateErrorCode.missing_type);

    await testRoot.remove();
  });
});

test.case("should write optional variables when --optional-variables flag is provided", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["opt-template"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--variables", value: "name" },
      { flag: "--optional-variables", value: "sub,subDescription" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgSingleUse("test-pkg").append("/opt-template/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).equals(["sub", "subDescription"]);

  await testRoot.remove();
});

test.case("should omit optional from JSON when --optional-variables is not provided", async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["no-opt"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--variables", value: "name" },
    ],
    context: { root: testRoot },
  });

  const outputPath = pkgSingleUse("test-pkg").append("/no-opt/instructions.json");
  const content = instructionsSchema.parse(await outputPath.json());
  assert(content.variables.required).equals(["name"]);
  assert(content.variables.optional).undefined();

  await testRoot.remove();
});

test.case(`should update package.json ${CLI_NAME} property after creating a powerup`, async assert => {
  await reset();
  await createTestPackage("test-pkg");

  await create.run({
    subcommands: ["test-powerup"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
    ],
    context: { root: testRoot },
  });

  const pkgJson = await internalFolder
    .append(`/test-pkg/${PACKAGE_FILE}`)
    .json() as Record<string, unknown>;
  const powerups = (pkgJson.powerups as Record<string, Record<string, Record<string, string>>>).active;
  assert(powerups[SINGLE_USE_FOLDER]["test-powerup"]).defined();

  await testRoot.remove();
});

test.case(`should add package to project config after creating a powerup`, async assert => {
  await reset();
  await createTestPackage("test-pkg");
  await mainFolder.append(`/${CONFIG_FILE}`).writeJSON({ packages: [] });

  await create.run({
    subcommands: ["test-powerup"],
    flags: [
      { flag: "--pack", value: "test-pkg" },
    ],
    context: { root: testRoot },
  });

  const config = await mainFolder.append(`/${CONFIG_FILE}`).json() as Record<string, unknown>;
  assert(config.packages).equals(["test-pkg"]);

  await testRoot.remove();
});

test.group("extractPackageDependencies", () => {
  test.case("extracts added dependencies", async assert => {
    const preImage = JSON.stringify({
      name: "test",
      dependencies: { existing: "^1.0.0" },
      devDependencies: {},
    });
    const postImage = JSON.stringify({
      name: "test",
      dependencies: { existing: "^1.0.0", "new-dep": "^2.3.4" },
      devDependencies: { "dev-dep": "^5.0.0" },
    });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "package.json" });
    assert(result.dependencies.length).equals(1);
    assert(result.dependencies[0]!.target).undefined();
    assert(result.dependencies[0]!.dependencies).equals(["new-dep@^2.3.4"]);
    assert(result.dependencies[0]!.devDependencies).equals(["dev-dep@^5.0.0"]);
    assert(result.hasNonDependencyChanges).false();
  });

  test.case("detects non-dependency changes", async assert => {
    const preImage = JSON.stringify({
      name: "test",
      version: "1.0.0",
      dependencies: { existing: "^1.0.0" },
    });
    const postImage = JSON.stringify({
      name: "test",
      version: "2.0.0",
      dependencies: { existing: "^1.0.0", "new-dep": "^2.3.4" },
    });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "package.json" });
    assert(result.dependencies.length).equals(1);
    assert(result.dependencies[0]!.dependencies).equals(["new-dep@^2.3.4"]);
    assert(result.hasNonDependencyChanges).true();
  });

  test.case("sets target for nested package.json", async assert => {
    const preImage = JSON.stringify({ dependencies: {} });
    const postImage = JSON.stringify({ dependencies: { "new-dep": "^1.0.0" } });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "packages/web/package.json" });
    assert(result.dependencies[0]!.target).equals("packages/web");
  });

  test.case("detects version changes as non-dependency changes", async assert => {
    const preImage = JSON.stringify({
      dependencies: { "existing-dep": "^1.0.0" },
    });
    const postImage = JSON.stringify({
      dependencies: { "existing-dep": "^2.0.0" },
    });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "package.json" });
    assert(result.dependencies.length).equals(1);
    assert(result.dependencies[0]!.dependencies).equals(["existing-dep@^2.0.0"]);
    assert(result.hasNonDependencyChanges).true();
  });

  test.case("returns empty for no dependency changes", async assert => {
    const preImage = JSON.stringify({
      name: "test",
      dependencies: { existing: "^1.0.0" },
    });
    const postImage = JSON.stringify({
      name: "test",
      dependencies: { existing: "^1.0.0" },
    });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "package.json" });
    assert(result.dependencies.length).equals(0);
    assert(result.hasNonDependencyChanges).false();
  });

  test.case("returns empty with nonDependencyChanges for invalid JSON", async assert => {
    const result = extractPackageDependencies({
      preImage: "not json",
      postImage: "also not json",
      filePath: "package.json",
    });
    assert(result.dependencies.length).equals(0);
    assert(result.hasNonDependencyChanges).true();
  });

  test.case("handles peerDependencies", async assert => {
    const preImage = JSON.stringify({ peerDependencies: {} });
    const postImage = JSON.stringify({ peerDependencies: { "peer-dep": "^3.0.0" } });

    const result = extractPackageDependencies({ preImage, postImage, filePath: "package.json" });
    assert(result.dependencies[0]!.peerDependencies).equals(["peer-dep@^3.0.0"]);
  });
});