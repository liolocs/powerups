import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import packCreate from "#commands/pack/create";
import packMove from "#commands/pack/move";
import { CodeError } from "@rcompat/error";
import { PackErrorCode } from "#errors/packErrors";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
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
  CLI_NAME,
  SINGULAR_NAME,
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

async function createConfig(packages: string[]) {
  await mainFolder.append(`/${CONFIG_FILE}`).writeJSON({
    harness: "claude",
    packages,
  });
}

async function createPackageOnDisk({
  packageName,
  powerups = [],
}: {
  packageName: string;
  powerups?: { name: string; type: "multi-use" | "single-use" }[];
}) {
  const pkgDir = internalFolder.append(`/${packageName}`);
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

  const powerupsProperty: Record<string, Record<string, string[]>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const power of powerups) {
    const typeFolder = power.type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
    const powerDir = srcActive.append(`/${typeFolder}/${power.name}`);
    await fs.create(powerDir);
    await powerDir.append("/instructions.json").writeJSON({
      name: power.name,
      description: "test",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
    });
    powerupsProperty[typeFolder][power.name] = [
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${power.name}/instructions.json`,
    ];
  }

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test package",
    keywords: [KEYWORD_PACKAGE],
    powerups: { active: powerupsProperty },
  });
}

function pkgDir(name: string): FileRef {
  return internalFolder.append(`/${name}`);
}

function pkgJson(name: string): FileRef {
  return pkgDir(name).append(`/${PACKAGE_FILE}`);
}

function configPath(): FileRef {
  return mainFolder.append(`/${CONFIG_FILE}`);
}

// ---------------------------------------------------------------------------
// pack create
// ---------------------------------------------------------------------------

test.group("pack create", () => {
  test.case("creates a local package with correct folder structure", async assert => {
    await reset();

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    });

    // Folder structure
    assert(await fs.exists(pkgDir("my-pkg"))).true();
    assert(await fs.exists(pkgDir("my-pkg").append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`))).true();
    assert(await fs.exists(pkgDir("my-pkg").append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}/${SINGLE_USE_FOLDER}`))).true();

    await testRoot.remove();
  });

  test.case("writes package.json with correct fields", async assert => {
    await reset();

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [{ flag: "--description", value: "A test package" }],
      context: { root: testRoot },
    });

    const pkg = await pkgJson("my-pkg").json() as Record<string, unknown>;
    assert(pkg.name).equals("my-pkg");
    assert(pkg.version).equals("1.0.0");
    assert(pkg.description).equals("A test package");
    assert(pkg.keywords).equals([KEYWORD_PACKAGE]);

    const powerups = (pkg[CLI_NAME] as Record<string, Record<string, Record<string, string[]>>>).active;
    assert(powerups[MULTI_USE_FOLDER]).equals({});
    assert(powerups[SINGLE_USE_FOLDER]).equals({});

    await testRoot.remove();
  });

  test.case("errors on duplicate package name", async assert => {
    await reset();
    await createPackageOnDisk({ packageName: "existing-pkg" });

    let threw;
    try {
      await packCreate.run({
        subcommands: ["existing-pkg"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.package_already_exists);

    await testRoot.remove();
  });

  test.case("does NOT update config after pack create", async assert => {
    await reset();
    await createConfig([]);

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    });

    const config = await configPath().json() as Record<string, unknown>;
    assert(config.packages).equals([]);

    await testRoot.remove();
  });

  test.case("errors on invalid package name with slash", async assert => {
    await reset();

    let threw;
    try {
      await packCreate.run({
        subcommands: ["bad/name"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.invalid_package_name);

    await testRoot.remove();
  });

  test.case(`errors when ${CLI_NAME} folder does not exist`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await packCreate.run({
        subcommands: ["my-pkg"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    // gain_errors.main_folder_not_found uses the create error code
    assert(threw).equals("main_folder_not_found");

    await testRoot.remove();
  });
});

// ---------------------------------------------------------------------------
// pack move
// ---------------------------------------------------------------------------

test.group("pack move", () => {
  test.case("errors on missing source package", async assert => {
    await reset();
    await createConfig([]);

    let threw;
    try {
      await packMove.run({
        subcommands: ["missing-pkg", "global"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.package_not_found);

    await testRoot.remove();
  });

  test.case("errors on invalid move destination", async assert => {
    await reset();
    await createPackageOnDisk({ packageName: "my-pkg" });
    await createConfig(["my-pkg"]);

    let threw;
    try {
      await packMove.run({
        subcommands: ["my-pkg", "nowhere"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.invalid_move_destination);

    await testRoot.remove();
  });

  test.case("detects circular includes", async assert => {
    await reset();
    // Create two powerups that include each other
    await createPackageOnDisk({
      packageName: "circular-pkg",
      powerups: [
        { name: "power-a", type: "multi-use" },
        { name: "power-b", type: "multi-use" },
      ],
    });
    await createConfig(["circular-pkg"]);

    // Make power-a include power-b and power-b include power-a
    const powerADir = internalFolder
      .append(`/circular-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/power-a`);
    await powerADir.append("/instructions.json").writeJSON({
      name: "power-a",
      description: "circular",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "power-b", variables: {} }],
    });

    const powerBDir = internalFolder
      .append(`/circular-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/power-b`);
    await powerBDir.append("/instructions.json").writeJSON({
      name: "power-b",
      description: "circular",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "power-a", variables: {} }],
    });

    let threw;
    try {
      await packMove.run({
        subcommands: ["circular-pkg", "global"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.circular_include);

    // Clean up: remove the local package so it doesn't interfere with other tests
    // (pack move didn't complete so local dir still exists)
    await testRoot.remove();
  });

  test.case(`errors on unresolvable sub-${SINGULAR_NAME} include`, async assert => {
    await reset();
    await createPackageOnDisk({
      packageName: "bad-include-pkg",
      powerups: [
        { name: "main-power", type: "multi-use" },
      ],
    });
    await createConfig(["bad-include-pkg"]);

    // Make main-power include a non-existent powerup
    const powerDir = internalFolder
      .append(`/bad-include-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/main-power`);
    await powerDir.append("/instructions.json").writeJSON({
      name: "main-power",
      description: "has bad include",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "nonexistent-power", variables: {} }],
    });

    let threw;
    try {
      await packMove.run({
        subcommands: ["bad-include-pkg", "global"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.subpower_unresolvable);

    await testRoot.remove();
  });
});