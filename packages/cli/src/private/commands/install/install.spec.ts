import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import install from "#commands/install/index";
import { CodeError } from "@rcompat/error";
import { InstallErrorCode } from "#errors/installErrors";
import { packageJsonSchema } from "#schemas/package";
import { readConfig, readGlobalConfig } from "#utils/config";
import {
  parseFragment,
  mergeFilters,
  buildConfigEntry,
} from "#utils/parse-powerup-fragment";
import {
  MAIN_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CLI_NAME,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CONFIG_FILE,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  // Create local .powerups (simulates project init)
  await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
  // Create global ~/.powerups (simulates global init) in testRoot
  await fs.create(testRoot.append(`/global-${MAIN_FOLDER}`));
}

/**
 * Write a valid powerups package.json into a store path (simulates the
 * post-fetch state). The real npm/git fetch is not invoked by these tests.
 */
async function writePackageJson(storeRoot: string, storePath: string, name: string, keywords = [KEYWORD_PACKAGE]) {
  const pkgDir = testRoot.append(`/${storeRoot}/${storePath}`);
  await fs.create(pkgDir);
  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name,
    version: "1.0.0",
    description: "test",
    keywords,
    [CLI_NAME]: {
      active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} },
    },
  });
  return pkgDir;
}

test.group("install — argument validation", () => {
  test.case("throws missing_source when no source given", async assert => {
    await reset();
    let threw;
    try {
      await install.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot, homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InstallErrorCode.missing_source);
    await testRoot.remove();
  });

  test.case("throws internal_not_installable for a bare name", async assert => {
    await reset();
    let threw;
    try {
      await install.run({
        subcommands: ["my-pkg"],
        flags: [],
        context: { root: testRoot, homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InstallErrorCode.internal_not_installable);
    await testRoot.remove();
  });
});

test.group("install — fragment parsing (pure functions)", () => {
  test.case("parses include fragment from source", assert => {
    assert(parseFragment("npm:pkg#use-form").filter)
      .equals({ include: ["use-form"] });
  });

  test.case("parses exclude fragment from git url", assert => {
    assert(parseFragment("https://github.com/foo/bar#!x").filter)
      .equals({ exclude: ["x"] });
  });

  test.case("merges flag include with fragment include", assert => {
    const merged = mergeFilters(parseFragment("npm:pkg#c").filter, "a,b");
    assert([...merged.include!].sort()).equals(["a", "b", "c"]);
  });

  test.case("builds plain string entry when no filter", assert => {
    assert(buildConfigEntry("npm:pkg", {})).equals("npm:pkg");
  });

  test.case("builds object entry when include present", assert => {
    assert(buildConfigEntry("npm:pkg", { include: ["a"] }))
      .equals({ package: "npm:pkg", powerups: { include: ["a"] } });
  });
});

test.group("install — powerups-package validation logic", () => {
  test.case("accepts a package with the powerups-package keyword", async assert => {
    await reset();
    await writePackageJson(`${MAIN_FOLDER}`, "npm/node_modules/good-pkg", "good-pkg");
    const pkgJson = packageJsonSchema.parse(
      await testRoot
        .append(`/${MAIN_FOLDER}/npm/node_modules/good-pkg/${PACKAGE_FILE}`)
        .json(),
    );
    assert(pkgJson.keywords.includes(KEYWORD_PACKAGE)).true();
    await testRoot.remove();
  });

  test.case("rejects a package without the powerups-package keyword", async assert => {
    await reset();
    await writePackageJson(`${MAIN_FOLDER}`, "npm/node_modules/bad-pkg", "bad-pkg", ["other-keyword"]);
    const pkgJson = packageJsonSchema.parse(
      await testRoot
        .append(`/${MAIN_FOLDER}/npm/node_modules/bad-pkg/${PACKAGE_FILE}`)
        .json(),
    );
    assert(pkgJson.keywords.includes(KEYWORD_PACKAGE)).false();
    await testRoot.remove();
  });
});

test.group("install — guards", () => {
  test.case("global install throws global_not_initialized when global not initialized", async assert => {
    await reset();
    // Remove global folder
    await testRoot.append(`/global-${MAIN_FOLDER}`).remove();
    // Rename to simulate: global folder doesn't exist at the homeDir path
    // We need homeDir to point to a dir without .powerups
    const noGlobalRoot = testRoot.append("/no-global");
    await fs.create(noGlobalRoot);

    let threw;
    try {
      await install.run({
        subcommands: ["npm:fake-pkg"],
        flags: [],
        context: { root: testRoot, homeDir: noGlobalRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InstallErrorCode.global_not_initialized);

    await testRoot.remove();
  });

  test.case("local install throws local_not_initialized when project not initialized", async assert => {
    await reset();
    // Remove local .powerups
    await testRoot.append(`/${MAIN_FOLDER}`).remove();

    let threw;
    try {
      await install.run({
        subcommands: ["npm:fake-pkg"],
        flags: [{ flag: "--local", value: "" }],
        context: { root: testRoot, homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InstallErrorCode.local_not_initialized);

    await testRoot.remove();
  });
});