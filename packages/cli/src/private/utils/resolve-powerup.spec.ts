import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolvePowerUp } from "#utils/resolve-powerup";
import { type PackageEntry } from "#utils/config";
import { CodeError } from "@rcompat/error";
import { PowerErrorCode } from "#errors/powerErrors";
import {
  CLI_FOLDER_NAME,
  INTERNAL_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CONFIG_FILE_NAME,
  PACKAGE_JSON,
  PACKAGE_JSON_KEYWORD_PROPERTY,
  CLI_NAME,
  SINGULAR_NAME_FOR_CLI,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function createPackage(
  projectRoot: FileRef,
  packageName: string,
  powerups: { name: string; type: "multi-use" | "single-use" }[] = [],
): Promise<void> {
  const pkgDir = projectRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${packageName}`,
  );
  const srcActive = pkgDir;

  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

  const powerupsProperty: Record<string, Record<string, string>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const powerup of powerups) {
    const typeFolder = powerup.type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
    const powerupDir = srcActive.append(`/${typeFolder}/${powerup.name}`);
    await fs.create(powerupDir);
    await powerupDir.append("/instructions.json").writeJSON({
      name: powerup.name,
      description: "test",
      variables: { required: [] },
      intent: [],
      steps: [],
    });
    powerupsProperty[typeFolder][powerup.name] =
      `./${typeFolder}/${powerup.name}/instructions.json`;
  }

  await pkgDir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test package",
    keywords: [PACKAGE_JSON_KEYWORD_PROPERTY],
    [CLI_NAME]: { active: powerupsProperty },
  });
}

async function createConfig(
  projectRoot: FileRef,
  packages: PackageEntry[],
): Promise<void> {
  const configDir = projectRoot.append(`/${CLI_FOLDER_NAME}`);
  await fs.create(configDir);
  await configDir.append(`/${CONFIG_FILE_NAME}`).writeJSON({
    packages,
  });
}

test.case(`resolves a ${SINGULAR_NAME_FOR_CLI} from a local package`, async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-powerup", type: "multi-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePowerUp(testRoot, "my-powerup");
  assert(result.type).equals("multi-use");
  assert(result.packageName).equals("my-pkg");
  assert(result.location).equals("local");
  assert(result.folder.name).equals("my-powerup");

  await testRoot.remove();
});

test.case(`resolves a single-use ${SINGULAR_NAME_FOR_CLI}`, async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-powerup", type: "single-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePowerUp(testRoot, "my-powerup");
  assert(result.type).equals("single-use");
  assert(result.packageName).equals("my-pkg");

  await testRoot.remove();
});

test.case(`throws not_found when ${SINGULAR_NAME_FOR_CLI} is not in any config-listed package`, async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-powerup", type: "multi-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  let threw;
  try {
    await resolvePowerUp(testRoot, "missing");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});

test.case("throws not_found when package is in config but missing from disk", async assert => {
  await reset();
  await createConfig(testRoot, ["missing-pkg"]);

  let threw;
  try {
    await resolvePowerUp(testRoot, "any-power");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});

test.case("resolves from second package when not in first", async assert => {
  await reset();
  await createPackage(testRoot, "pkg-a", [{ name: "power-a", type: "multi-use" }]);
  await createPackage(testRoot, "pkg-b", [{ name: "power-b", type: "multi-use" }]);
  await createConfig(testRoot, ["pkg-a", "pkg-b"]);

  const result = await resolvePowerUp(testRoot, "power-b");
  assert(result.packageName).equals("pkg-b");

  await testRoot.remove();
});

test.case(`throws ambiguous when same ${SINGULAR_NAME_FOR_CLI} name in multiple local packages`, async assert => {
  await reset();
  await createPackage(testRoot, "pkg-a", [{ name: "shared", type: "multi-use" }]);
  await createPackage(testRoot, "pkg-b", [{ name: "shared", type: "multi-use" }]);
  await createConfig(testRoot, ["pkg-a", "pkg-b"]);

  let threw;
  try {
    await resolvePowerUp(testRoot, "shared");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.ambiguous);

  await testRoot.remove();
});

test.case(`disambiguates by type when same ${SINGULAR_NAME_FOR_CLI} in both types in same package`, async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [
    { name: "shared", type: "multi-use" },
    { name: "shared", type: "single-use" },
  ]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePowerUp(testRoot, "shared", "multi-use");
  assert(result.type).equals("multi-use");

  await testRoot.remove();
});

test.case("throws not_found when config has no packages", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-powerup", type: "multi-use" }]);
  await createConfig(testRoot, []);

  let threw;
  try {
    await resolvePowerUp(testRoot, "my-powerup");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});
test.group("resolvePowerUp with powerups filters", () => {
  test.case("include filter allows only listed powerups", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "a", type: "multi-use" },
      { name: "b", type: "multi-use" },
      { name: "c", type: "multi-use" },
    ]);
    const entry: PackageEntry = { package: "my-pkg", powerups: { include: ["a"] } };
    await createConfig(testRoot, [entry]);

    const result = await resolvePowerUp(testRoot, "a");
    assert(result.packageName).equals("my-pkg");

    let threw;
    try {
      await resolvePowerUp(testRoot, "b");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PowerErrorCode.not_found);

    await testRoot.remove();
  });

  test.case("exclude filter blocks listed powerups", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "a", type: "multi-use" },
      { name: "b", type: "multi-use" },
      { name: "c", type: "multi-use" },
    ]);
    const entry: PackageEntry = { package: "my-pkg", powerups: { exclude: ["b"] } };
    await createConfig(testRoot, [entry]);

    assert((await resolvePowerUp(testRoot, "a")).packageName).equals("my-pkg");
    assert((await resolvePowerUp(testRoot, "c")).packageName).equals("my-pkg");

    let threw;
    try {
      await resolvePowerUp(testRoot, "b");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PowerErrorCode.not_found);

    await testRoot.remove();
  });

  test.case("include and exclude combined", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "a", type: "multi-use" },
      { name: "b", type: "multi-use" },
    ]);
    const entry: PackageEntry = {
      package: "my-pkg",
      powerups: { include: ["a", "b"], exclude: ["b"] },
    };
    await createConfig(testRoot, [entry]);

    assert((await resolvePowerUp(testRoot, "a")).packageName).equals("my-pkg");

    let threw;
    try {
      await resolvePowerUp(testRoot, "b");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PowerErrorCode.not_found);

    await testRoot.remove();
  });

  test.case("object entry without powerups behaves like a plain string", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [{ name: "a", type: "multi-use" }]);
    const entry: PackageEntry = { package: "my-pkg" };
    await createConfig(testRoot, [entry]);

    const result = await resolvePowerUp(testRoot, "a");
    assert(result.packageName).equals("my-pkg");

    await testRoot.remove();
  });
});

test.group("resolvePowerUp with fallbackToGlobal", () => {
  test.case("throws not_initialized when neither local nor global config exists", async assert => {
    await reset();

    let threw;
    try {
      await resolvePowerUp(testRoot, "any-power", undefined, {
        fallbackToGlobal: true,
        homeDir: testRoot.path,
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PowerErrorCode.not_initialized);

    await testRoot.remove();
  });

  test.case("resolves from global config when no local config exists", async assert => {
    await reset();
    // Create a package in the local store
    await createPackage(testRoot, "global-pkg", [{ name: "global-power", type: "multi-use" }]);
    // Create global config (no local config)
    const homeDir = testRoot.append("/home");
    await fs.create(homeDir.append(`/${CLI_FOLDER_NAME}`));
    await homeDir.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`).writeJSON({ packages: ["global-pkg"] });

    // Resolve with fallbackToGlobal — package exists in local store, config entry from global
    const result = await resolvePowerUp(testRoot, "global-power", undefined, {
      fallbackToGlobal: true,
      homeDir: homeDir.path,
    });
    assert(result.packageName).equals("global-pkg");
    assert(result.location).equals("local");

    await testRoot.remove();
  });

  test.case("merges local + global config, local takes priority by source", async assert => {
    await reset();
    // Create packages
    await createPackage(testRoot, "local-pkg", [{ name: "local-power", type: "multi-use" }]);
    await createPackage(testRoot, "global-pkg", [{ name: "global-power", type: "multi-use" }]);
    // Create local config with local-pkg
    await createConfig(testRoot, ["local-pkg"]);
    // Create global config with both packages (local-pkg should be deduped)
    const homeDir = testRoot.append("/home");
    await fs.create(homeDir.append(`/${CLI_FOLDER_NAME}`));
    await homeDir.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`).writeJSON({ packages: ["local-pkg", "global-pkg"] });

    // Both powers should be found
    const localResult = await resolvePowerUp(testRoot, "local-power", undefined, {
      fallbackToGlobal: true,
      homeDir: homeDir.path,
    });
    assert(localResult.packageName).equals("local-pkg");

    const globalResult = await resolvePowerUp(testRoot, "global-power", undefined, {
      fallbackToGlobal: true,
      homeDir: homeDir.path,
    });
    assert(globalResult.packageName).equals("global-pkg");

    await testRoot.remove();
  });

  test.case("without fallbackToGlobal, throws not_found when no local config", async assert => {
    await reset();

    let threw;
    try {
      await resolvePowerUp(testRoot, "any-power");
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PowerErrorCode.not_found);

    await testRoot.remove();
  });
});
