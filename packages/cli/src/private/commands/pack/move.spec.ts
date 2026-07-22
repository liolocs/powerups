import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import packMove from "#commands/pack/move";
import { readGlobalConfig, writeGlobalConfig } from "#utils/config";
import { CodeError } from "@rcompat/error";
import { PackErrorCode } from "#errors/packErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  TEMPLATE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CONFIG_FILE,
  CLI_NAME,
  GLOBAL_INTERNAL_PATH,
  GLOBAL_CONFIG_PATH,
  SINGULAR_NAME,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/move-spec");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);
const internalFolder = mainFolder.append(`/${INTERNAL_FOLDER}`);
const globalInternal = fs.ref(GLOBAL_INTERNAL_PATH);
const globalConfigFile = fs.ref(GLOBAL_CONFIG_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  const powerupsProperty: Record<string, Record<string, string>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const power of powerups) {
    const typeFolder = power.type === "multi-use"
      ? MULTI_USE_FOLDER
      : SINGLE_USE_FOLDER;
    const powerDir = srcActive.append(`/${typeFolder}/${power.name}`);
    await fs.create(powerDir);
    await powerDir.append("/instructions.json").writeJSON({
      name: power.name,
      description: "test",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
    });
    powerupsProperty[typeFolder][power.name] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${power.name}/instructions.json`;
  }

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test package",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: { active: powerupsProperty },
  });
}

/**
 * Add a template/ folder (with flat + nested files) to a powerup dir.
 */
async function addTemplate(powerupDir: FileRef) {
  const templateDir = powerupDir.append(`/${TEMPLATE_FOLDER}`);
  await fs.create(templateDir);
  await templateDir.append("/flat.txt").write("flat content");

  const nestedDir = templateDir.append("/nested/sub");
  await fs.create(nestedDir);
  await nestedDir.append("/deep.txt").write("deep content");
}

/**
 * Save and restore the global config so tests don't clobber the user's
 * real global config. Also removes any test-created global package dirs.
 */
let savedGlobalConfig: string | null = null;

async function saveGlobalState() {
  if (await fs.exists(globalConfigFile)) {
    savedGlobalConfig = await globalConfigFile.text();
  } else {
    savedGlobalConfig = null;
  }
}

async function restoreGlobalState(packageNames: string[]) {
  // Remove test-created global package dirs
  for (const name of packageNames) {
    const dir = globalInternal.append(`/${name}`);
    if (await fs.exists(dir)) {
      await dir.remove();
    }
  }
  // Restore global config
  if (savedGlobalConfig !== null) {
    await globalConfigFile.write(savedGlobalConfig);
  } else {
    if (await fs.exists(globalConfigFile)) {
      await globalConfigFile.remove();
    }
  }
}

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

test.group("pack move (errors)", () => {
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
    await createPackageOnDisk({
      packageName: "circular-pkg",
      powerups: [
        { name: "power-a", type: "multi-use" },
        { name: "power-b", type: "multi-use" },
      ],
    });
    await createConfig(["circular-pkg"]);

    const powerADir = internalFolder.append(
      `/circular-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/power-a`,
    );
    await powerADir.append("/instructions.json").writeJSON({
      name: "power-a",
      description: "circular",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "power-b", variables: {} }],
    });

    const powerBDir = internalFolder.append(
      `/circular-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/power-b`,
    );
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

    await testRoot.remove();
  });

  test.case(`errors on unresolvable sub-${SINGULAR_NAME} include`, async assert => {
    await reset();
    await createPackageOnDisk({
      packageName: "bad-include-pkg",
      powerups: [{ name: "main-power", type: "multi-use" }],
    });
    await createConfig(["bad-include-pkg"]);

    const powerDir = internalFolder.append(
      `/bad-include-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/main-power`,
    );
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

// ---------------------------------------------------------------------------
// Success cases
// ---------------------------------------------------------------------------

test.group("pack move (success)", () => {
  test.case("moves a simple package with powerup folders to global", async assert => {
    const pkgName = "move-test-simple";
    await reset();
    await createPackageOnDisk({
      packageName: pkgName,
      powerups: [{ name: "my-power", type: "multi-use" }],
    });
    await createConfig([pkgName]);

    // Add a template with nested files to verify recursive copy
    const powerDir = internalFolder.append(
      `/${pkgName}/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/my-power`,
    );
    await addTemplate(powerDir);

    await saveGlobalState();
    try {
      await packMove.run({
        subcommands: [pkgName, "global"],
        flags: [],
        context: { root: testRoot },
      });

      // Verify global package dir exists
      const globalPkg = globalInternal.append(`/${pkgName}`);
      assert(await fs.exists(globalPkg)).true();

      // Verify powerup folder was copied
      const globalPower = globalPkg.append(
        `/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/my-power`,
      );
      assert(await fs.exists(globalPower)).true();

      // Verify instructions.json was copied
      const instr = await globalPower
        .append("/instructions.json")
        .json() as Record<string, unknown>;
      assert(instr.name).equals("my-power");

      // Verify template flat file was copied
      const flat = await globalPower
        .append(`/${TEMPLATE_FOLDER}/flat.txt`)
        .text();
      assert(flat.trim()).equals("flat content");

      // Verify nested template sub-folder file was copied
      const deep = await globalPower
        .append(`/${TEMPLATE_FOLDER}/nested/sub/deep.txt`)
        .text();
      assert(deep.trim()).equals("deep content");

      // Verify global package.json has correct name
      const globalPkgJson = await globalPkg
        .append(`/${PACKAGE_FILE}`)
        .json() as Record<string, unknown>;
      assert(globalPkgJson.name).equals(pkgName);

      // Verify package was added to global config
      const globalConfig = await readGlobalConfig();
      assert(globalConfig.packages.includes(pkgName)).true();
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });

  test.case("moves a package with sub-powerup includes", async assert => {
    const pkgName = "move-test-subs";
    await reset();
    // Create two packages: one with the main power, one with the sub-power
    await createPackageOnDisk({
      packageName: pkgName,
      powerups: [{ name: "main-power", type: "multi-use" }],
    });
    await createPackageOnDisk({
      packageName: "sub-pkg",
      powerups: [{ name: "sub-power", type: "single-use" }],
    });
    await createConfig([pkgName, "sub-pkg"]);

    // Make main-power include sub-power
    const mainPowerDir = internalFolder.append(
      `/${pkgName}/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/main-power`,
    );
    await mainPowerDir.append("/instructions.json").writeJSON({
      name: "main-power",
      description: "has sub include",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "sub-power", variables: {} }],
    });

    await saveGlobalState();
    try {
      await packMove.run({
        subcommands: [pkgName, "global"],
        flags: [],
        context: { root: testRoot },
      });

      const globalPkg = globalInternal.append(`/${pkgName}`);

      // Verify main powerup was copied
      const globalMain = globalPkg.append(
        `/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/main-power`,
      );
      assert(await fs.exists(globalMain)).true();

      // Verify sub-powerup was copied into the destination
      const globalSub = globalPkg.append(
        `/${SRC_FOLDER}/${ACTIVE_FOLDER}/${SINGLE_USE_FOLDER}/sub-power`,
      );
      assert(await fs.exists(globalSub)).true();

      // Verify parent:child entry in global package.json
      const globalPkgJson = await globalPkg
        .append(`/${PACKAGE_FILE}`)
        .json() as Record<string, unknown>;
      const powerupsProp = globalPkgJson[CLI_NAME] as unknown as {
        active: Record<string, Record<string, string>>;
      };
      const active = powerupsProp.active;
      assert(active[SINGLE_USE_FOLDER]["main-power:sub-power"]).defined();

      // Both packages should be in global config
      const globalConfig = await readGlobalConfig();
      assert(globalConfig.packages.includes(pkgName)).true();
    } finally {
      await restoreGlobalState([pkgName, "sub-pkg"]);
    }

    await testRoot.remove();
  });

  test.case("removes package from project config with --delete flag", async assert => {
    const pkgName = "move-test-delete";
    await reset();
    await createPackageOnDisk({
      packageName: pkgName,
      powerups: [{ name: "del-power", type: "multi-use" }],
    });
    await createConfig([pkgName]);

    await saveGlobalState();
    try {
      await packMove.run({
        subcommands: [pkgName, "global"],
        flags: [{ flag: "--delete", value: "true" }],
        context: { root: testRoot },
      });

      // Verify package was removed from project config
      const config = await mainFolder
        .append(`/${CONFIG_FILE}`)
        .json() as Record<string, unknown>;
      const packages = config.packages as string[];
      assert(packages.includes(pkgName)).false();

      // Verify it was added to global config
      const globalConfig = await readGlobalConfig();
      assert(globalConfig.packages.includes(pkgName)).true();
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });

  test.case("keeps package in project config without --delete flag", async assert => {
    const pkgName = "move-test-keep";
    await reset();
    await createPackageOnDisk({
      packageName: pkgName,
      powerups: [{ name: "keep-power", type: "multi-use" }],
    });
    await createConfig([pkgName]);

    await saveGlobalState();
    try {
      await packMove.run({
        subcommands: [pkgName, "global"],
        flags: [],
        context: { root: testRoot },
      });

      // Verify package is still in project config
      const config = await mainFolder
        .append(`/${CONFIG_FILE}`)
        .json() as Record<string, unknown>;
      const packages = config.packages as string[];
      assert(packages.includes(pkgName)).true();
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });
});