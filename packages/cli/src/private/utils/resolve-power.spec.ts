import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { resolvePower } from "#utils/resolve-power";
import { CodeError } from "@rcompat/error";
import { PowerErrorCode } from "#errors/powerErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CONFIG_FILE,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
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
  powers: { name: string; type: "multi-use" | "single-use" }[] = [],
): Promise<void> {
  const pkgDir = projectRoot.append(
    `/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`,
  );
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);

  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

  const powersProperty: Record<string, Record<string, string[]>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const power of powers) {
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
    powersProperty[typeFolder][power.name] = [
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${power.name}/instructions.json`,
    ];
  }

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test package",
    keywords: [KEYWORD_PACKAGE],
    powers: { active: powersProperty },
  });
}

async function createConfig(
  projectRoot: FileRef,
  packages: string[],
  harness = "claude",
): Promise<void> {
  const configDir = projectRoot.append(`/${MAIN_FOLDER}`);
  await fs.create(configDir);
  await configDir.append(`/${CONFIG_FILE}`).writeJSON({
    harness,
    packages,
  });
}

test.case("resolves a power from a local package", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-power", type: "multi-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePower(testRoot, "my-power");
  assert(result.type).equals("multi-use");
  assert(result.packageName).equals("my-pkg");
  assert(result.location).equals("local");
  assert(result.folder.name).equals("my-power");

  await testRoot.remove();
});

test.case("resolves a single-use power", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-power", type: "single-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePower(testRoot, "my-power");
  assert(result.type).equals("single-use");
  assert(result.packageName).equals("my-pkg");

  await testRoot.remove();
});

test.case("throws not_found when power is not in any config-listed package", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-power", type: "multi-use" }]);
  await createConfig(testRoot, ["my-pkg"]);

  let threw;
  try {
    await resolvePower(testRoot, "missing");
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
    await resolvePower(testRoot, "any-power");
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

  const result = await resolvePower(testRoot, "power-b");
  assert(result.packageName).equals("pkg-b");

  await testRoot.remove();
});

test.case("throws ambiguous when same power name in multiple local packages", async assert => {
  await reset();
  await createPackage(testRoot, "pkg-a", [{ name: "shared", type: "multi-use" }]);
  await createPackage(testRoot, "pkg-b", [{ name: "shared", type: "multi-use" }]);
  await createConfig(testRoot, ["pkg-a", "pkg-b"]);

  let threw;
  try {
    await resolvePower(testRoot, "shared");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.ambiguous);

  await testRoot.remove();
});

test.case("disambiguates by type when same power in both types in same package", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [
    { name: "shared", type: "multi-use" },
    { name: "shared", type: "single-use" },
  ]);
  await createConfig(testRoot, ["my-pkg"]);

  const result = await resolvePower(testRoot, "shared", "multi-use");
  assert(result.type).equals("multi-use");

  await testRoot.remove();
});

test.case("throws not_found when config has no packages", async assert => {
  await reset();
  await createPackage(testRoot, "my-pkg", [{ name: "my-power", type: "multi-use" }]);
  await createConfig(testRoot, []);

  let threw;
  try {
    await resolvePower(testRoot, "my-power");
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(PowerErrorCode.not_found);

  await testRoot.remove();
});