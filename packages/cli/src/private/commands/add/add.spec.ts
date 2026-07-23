import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import add from "#commands/add/index";
import { CodeError } from "@rcompat/error";
import { AddErrorCode } from "#errors/addErrors";
import { readConfig, type PackageEntry } from "#utils/config";
import captureStdout from "#test-utils/capture-stdout";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CLI_NAME,
  CONFIG_FILE,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
}

async function createPackage(
  projectRoot: FileRef,
  packageName: string,
  powerups: { name: string; type: "multi-use" | "single-use" }[] = [],
) {
  const pkgDir = projectRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`);
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));

  const powerupsProperty: Record<string, Record<string, string>> = {
    [MULTI_USE_FOLDER]: {},
    [SINGLE_USE_FOLDER]: {},
  };

  for (const powerup of powerups) {
    const typeFolder = powerup.type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
    const dir = srcActive.append(`/${typeFolder}/${powerup.name}`);
    await fs.create(dir);
    await dir.append("/instructions.json").writeJSON({
      name: powerup.name, description: "test", variables: { required: [] }, intent: [], steps: [],
    });
    powerupsProperty[typeFolder][powerup.name] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${powerup.name}/instructions.json`;
  }

  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "test package",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: { active: powerupsProperty },
  });
}

async function createConfig(packages: PackageEntry[]) {
  await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).writeJSON({
    packages,
  });
}

test.group("add", () => {
  test.case("adds a local package to config as a plain string", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [{ name: "a", type: "multi-use" }]);
    await createConfig([]);

    const output = await captureStdout(() => add.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("Added my-pkg");
    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["my-pkg"]);
    await testRoot.remove();
  });

  test.case("adds an object entry via fragment include", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "use-form", type: "multi-use" },
      { name: "other", type: "multi-use" },
    ]);
    await createConfig([]);

    await captureStdout(() => add.run({
      subcommands: ["my-pkg#use-form"],
      flags: [],
      context: { root: testRoot },
    }));

    const config = await readConfig(testRoot);
    assert(config?.packages[0]).equals({
      package: "my-pkg",
      powerups: { include: ["use-form"] },
    });
    await testRoot.remove();
  });

  test.case("adds an object entry via --include flag", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "use-form", type: "multi-use" },
      { name: "use-debounce", type: "multi-use" },
    ]);
    await createConfig([]);

    await captureStdout(() => add.run({
      subcommands: ["my-pkg"],
      flags: [{ flag: "--include", value: "use-form,use-debounce" }],
      context: { root: testRoot },
    }));

    const config = await readConfig(testRoot);
    const entry = config!.packages[0] as { package: string; powerups: { include: string[] } };
    assert(entry.package).equals("my-pkg");
    assert(entry.powerups.include!.sort()).equals(["use-debounce", "use-form"]);
    await testRoot.remove();
  });

  test.case("adds an object entry with exclude via fragment", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [{ name: "old-thing", type: "multi-use" }]);
    await createConfig([]);

    await captureStdout(() => add.run({
      subcommands: ["my-pkg#!old-thing"],
      flags: [],
      context: { root: testRoot },
    }));

    const config = await readConfig(testRoot);
    assert(config?.packages[0]).equals({
      package: "my-pkg",
      powerups: { exclude: ["old-thing"] },
    });
    await testRoot.remove();
  });

  test.case("combines --include and --exclude flags", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [
      { name: "a", type: "multi-use" },
      { name: "b", type: "multi-use" },
    ]);
    await createConfig([]);

    await captureStdout(() => add.run({
      subcommands: ["my-pkg"],
      flags: [
        { flag: "--include", value: "a,b" },
        { flag: "--exclude", value: "b" },
      ],
      context: { root: testRoot },
    }));

    const config = await readConfig(testRoot);
    const entry = config!.packages[0] as {
      package: string; powerups: { include: string[]; exclude: string[] }
    };
    assert(entry.powerups.include!.sort()).equals(["a", "b"]);
    assert(entry.powerups.exclude).equals(["b"]);
    await testRoot.remove();
  });

  test.case("updates existing entry on re-add (dedup)", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [{ name: "a", type: "multi-use" }]);
    await createConfig(["my-pkg"]);

    await captureStdout(() => add.run({
      subcommands: ["my-pkg#a"],
      flags: [],
      context: { root: testRoot },
    }));

    const config = await readConfig(testRoot);
    assert(config?.packages.length).equals(1);
    assert(config?.packages[0]).equals({
      package: "my-pkg",
      powerups: { include: ["a"] },
    });
    await testRoot.remove();
  });

  test.case("throws missing_source when no source given", async assert => {
    await reset();
    await createConfig([]);

    let threw;
    try {
      await add.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(AddErrorCode.missing_source);
    await testRoot.remove();
  });

  test.case("throws package_not_installed when source not found", async assert => {
    await reset();
    await createConfig([]);

    let threw;
    try {
      await add.run({
        subcommands: ["npm:missing-pkg"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(AddErrorCode.package_not_installed);
    await testRoot.remove();
  });

  test.case("throws not_a_powerups_package when keyword missing", async assert => {
    await reset();
    // Create a package in the internal store without the powerups-package keyword.
    const pkgDir = testRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/plain-pkg`);
    await fs.create(pkgDir);
    await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
      name: "plain-pkg",
      version: "1.0.0",
      description: "test",
      keywords: ["other"],
      [CLI_NAME]: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
    });
    await createConfig([]);

    let threw;
    try {
      await add.run({
        subcommands: ["plain-pkg"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(AddErrorCode.not_a_powerups_package);
    await testRoot.remove();
  });

  test.case("warns (but proceeds) for unknown powerup names in include", async assert => {
    await reset();
    await createPackage(testRoot, "my-pkg", [{ name: "a", type: "multi-use" }]);
    await createConfig([]);

    const output = await captureStdout(() => add.run({
      subcommands: ["my-pkg#nonexistent"],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("Warning: powerup \"nonexistent\" not found");
    assert(output).includes("Added my-pkg");
    const config = await readConfig(testRoot);
    assert(config?.packages[0]).equals({
      package: "my-pkg",
      powerups: { include: ["nonexistent"] },
    });
    await testRoot.remove();
  });

  test.case("throws project_not_initialized when no .powerups folder", async assert => {
    await reset();
    // Remove the .powerups folder to simulate project not initialized
    await testRoot.append(`/${MAIN_FOLDER}`).remove();

    let threw;
    try {
      await add.run({
        subcommands: ["my-pkg"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(AddErrorCode.project_not_initialized);

    await testRoot.remove();
  });
});