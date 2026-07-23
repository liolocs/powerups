import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import list from "#commands/list/index";
import captureStdout from "#test-utils/capture-stdout";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  NPM_STORE,
  GIT_STORE,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CLI_NAME,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CONFIG_FILE,
  SRC_FOLDER,
  ACTIVE_FOLDER,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
}

/**
 * Write a valid powerups package.json into a store-relative path.
 */
async function writePackage(
  projectRoot: FileRef,
  storePath: string,
  name: string,
  powerups: { multiUse?: string[]; singleUse?: string[] } = {},
) {
  const pkgDir = projectRoot.append(`/${MAIN_FOLDER}/${storePath}`);
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

  const powerupsProperty: Record<string, Record<string, string>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const powerName of powerups.multiUse ?? []) {
    const dir = srcActive.append(`/${MULTI_USE_FOLDER}/${powerName}`);
    await fs.create(dir);
    await dir.append("/instructions.json").writeJSON({
      name: powerName, description: "t", variables: { required: [] }, intent: [], steps: [],
    });
    powerupsProperty[MULTI_USE_FOLDER][powerName] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}/${powerName}/instructions.json`;
  }
  for (const powerName of powerups.singleUse ?? []) {
    const dir = srcActive.append(`/${SINGLE_USE_FOLDER}/${powerName}`);
    await fs.create(dir);
    await dir.append("/instructions.json").writeJSON({
      name: powerName, description: "t", variables: { required: [] }, intent: [], steps: [],
    });
    powerupsProperty[SINGLE_USE_FOLDER][powerName] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${SINGLE_USE_FOLDER}/${powerName}/instructions.json`;
  }

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name,
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: { active: powerupsProperty },
  });
}

async function createConfig(packages: any[]) {
  await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).writeJSON({
    harness: "claude",
    packages,
  });
}

test.group("list", () => {
  test.case("lists unregistered internal package", async assert => {
    await reset();
    await writePackage(testRoot, `${INTERNAL_FOLDER}/my-pkg`, "my-pkg",
      { multiUse: ["a-power"] });
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("my-pkg");
    assert(output).includes("internal:");
    assert(output).includes("a-power");
    await testRoot.remove();
  });

  test.case("lists unregistered npm package", async assert => {
    await reset();
    await writePackage(testRoot, `${NPM_STORE}/node_modules/other-pkg`, "other-pkg",
      { multiUse: ["b-power"] });
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("npm:other-pkg");
    assert(output).includes("npm:");
    assert(output).includes("b-power");
    await testRoot.remove();
  });

  test.case("lists unregistered git package with reconstructed https source", async assert => {
    await reset();
    await writePackage(testRoot, `${GIT_STORE}/github.com/foo/bar`, "bar",
      { singleUse: ["c-power"] });
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("https://github.com/foo/bar");
    assert(output).includes("git:");
    assert(output).includes("c-power");
    assert(output).includes("single-use");
    await testRoot.remove();
  });

  test.case("excludes registered package (plain string entry)", async assert => {
    await reset();
    await writePackage(testRoot, `${INTERNAL_FOLDER}/my-pkg`, "my-pkg");
    await createConfig(["my-pkg"]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    // The test package must not appear as an unregistered local package.
    assert(output.includes("internal:  my-pkg")).false();
    await testRoot.remove();
  });

  test.case("excludes registered package (object entry)", async assert => {
    await reset();
    await writePackage(testRoot, `${NPM_STORE}/node_modules/other-pkg`, "other-pkg");
    await createConfig([{ package: "npm:other-pkg", powerups: { include: ["a"] } }]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output.includes("npm:other-pkg")).false();
    await testRoot.remove();
  });

  test.case("skips invalid package.json silently", async assert => {
    await reset();
    const pkgDir = testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/bad-pkg`);
    await fs.create(pkgDir);
    await pkgDir.append(`/${PACKAGE_FILE}`).write("{ not valid json");
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output.includes("internal:  bad-pkg")).false();
    await testRoot.remove();
  });

  test.case("does not list packages when none installed locally", async assert => {
    await reset();
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    // No local packages should be reported (global store may have its own).
    assert(output.includes("local:")).false();
    await testRoot.remove();
  });

  test.case("handles scoped npm package (@scope/pkg)", async assert => {
    await reset();
    await writePackage(testRoot, `${NPM_STORE}/node_modules/@scope/scoped-pkg`, "@scope/scoped-pkg",
      { multiUse: ["scoped-power"] });
    await createConfig([]);

    const output = await captureStdout(() => list.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("npm:@scope/scoped-pkg");
    assert(output).includes("scoped-power");
    await testRoot.remove();
  });
});