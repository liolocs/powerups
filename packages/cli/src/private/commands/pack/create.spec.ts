import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import packCreate from "#commands/pack/create";
import { CodeError } from "@rcompat/error";
import { PackErrorCode } from "#errors/packErrors";
import captureStdout from "#test-utils/capture-stdout";
import {
  CLI_FOLDER_NAME,
  INTERNAL_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_JSON,
  PACKAGE_JSON_KEYWORD_PROPERTY,
  CLI_NAME,
  GLOBAL_INTERNAL_PATH,
  GLOBAL_ROOT,
  GLOBAL_CONFIG_PATH,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/create-spec");
const mainFolder = testRoot.append(`/${CLI_FOLDER_NAME}`);
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

function pkgDir(name: string): FileRef {
  return internalFolder.append(`/${name}`);
}

function pkgJson(name: string): FileRef {
  return pkgDir(name).append(`/${PACKAGE_JSON}`);
}

/**
 * Pre-create a package on disk so that "already exists" tests can detect it.
 */
async function createPackageOnDisk(packageName: string) {
  const dir = internalFolder.append(`/${packageName}`);
  const srcActive = dir;
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
  await dir.append(`/${PACKAGE_JSON}`).writeJSON({
    name: packageName,
    version: "1.0.0",
    description: "",
    keywords: [PACKAGE_JSON_KEYWORD_PROPERTY],
    [CLI_NAME]: {
      active: {
        [MULTI_USE_FOLDER]: {},
        [SINGLE_USE_FOLDER]: {},
      },
    },
  });
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

test.group("pack create (errors)", () => {
  test.case("errors on missing package name", async assert => {
    await reset();

    let threw;
    try {
      await packCreate.run({
        subcommands: [],
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

  test.case("errors on empty package name", async assert => {
    await reset();

    let threw;
    try {
      await packCreate.run({
        subcommands: [""],
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

  test.case("errors on duplicate package name", async assert => {
    await reset();
    await createPackageOnDisk("existing-pkg");

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
    // create_errors.main_folder_not_found uses this error code
    assert(threw).equals("main_folder_not_found");

    await testRoot.remove();
  });
});

// ---------------------------------------------------------------------------
// Local success cases
// ---------------------------------------------------------------------------

test.group("pack create (local)", () => {
  test.case("creates a local package with correct folder structure", async assert => {
    await reset();

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    });

    // Package dir
    assert(await fs.exists(pkgDir("my-pkg"))).true();
    // multi-use
    assert(await fs.exists(
      pkgDir("my-pkg").append(`/${MULTI_USE_FOLDER}`),
    )).true();
    // single-use
    assert(await fs.exists(
      pkgDir("my-pkg").append(`/${SINGLE_USE_FOLDER}`),
    )).true();

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
    assert(pkg.keywords).equals([PACKAGE_JSON_KEYWORD_PROPERTY]);

    const powerups = (pkg[CLI_NAME] as Record<string, Record<string, Record<string, string>>>).active;
    assert(powerups[MULTI_USE_FOLDER]).equals({});
    assert(powerups[SINGLE_USE_FOLDER]).equals({});

    await testRoot.remove();
  });

  test.case("defaults description to empty string when --description not passed", async assert => {
    await reset();

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    });

    const pkg = await pkgJson("my-pkg").json() as Record<string, unknown>;
    assert(pkg.description).equals("");

    await testRoot.remove();
  });

  test.case("does NOT update config after pack create", async assert => {
    await reset();

    // Even if a config exists, create should not modify it
    await mainFolder.append("/config.json").writeJSON({
      packages: [],
    });

    await packCreate.run({
      subcommands: ["my-pkg"],
      flags: [],
      context: { root: testRoot },
    });

    const config = await mainFolder
      .append("/config.json")
      .json() as Record<string, unknown>;
    assert(config.packages).equals([]);

    await testRoot.remove();
  });

  test.case("prints success message for local package", async assert => {
    await reset();

    const output = await captureStdout(() =>
      packCreate.run({
        subcommands: ["my-pkg"],
        flags: [],
        context: { root: testRoot },
      }),
    );

    assert(output.includes("Created package: my-pkg (local)")).true();
    assert(output.includes("location:")).true();

    await testRoot.remove();
  });
});

// ---------------------------------------------------------------------------
// Global success cases
// ---------------------------------------------------------------------------

test.group("pack create (global)", () => {
  test.case("creates a global package with correct folder structure", async assert => {
    const pkgName = "create-glob-test";
    await reset();
    await saveGlobalState();
    try {
      await packCreate.run({
        subcommands: [pkgName],
        flags: [{ flag: "--global", value: "true" }],
        context: { root: testRoot },
      });

      const globalPkg = globalInternal.append(`/${pkgName}`);
      assert(await fs.exists(globalPkg)).true();
      assert(await fs.exists(
        globalPkg.append(`/${MULTI_USE_FOLDER}`),
      )).true();
      assert(await fs.exists(
        globalPkg.append(`/${SINGLE_USE_FOLDER}`),
      )).true();

      // Verify package.json
      const pkg = await globalPkg
        .append(`/${PACKAGE_JSON}`)
        .json() as Record<string, unknown>;
      assert(pkg.name).equals(pkgName);
      assert(pkg.version).equals("1.0.0");
      assert(pkg.keywords).equals([PACKAGE_JSON_KEYWORD_PROPERTY]);

      const powerups = (pkg[CLI_NAME] as Record<string, Record<string, Record<string, string>>>).active;
      assert(powerups[MULTI_USE_FOLDER]).equals({});
      assert(powerups[SINGLE_USE_FOLDER]).equals({});
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });

  test.case("prints success message for global package", async assert => {
    const pkgName = "create-glob-msg";
    await reset();
    await saveGlobalState();
    try {
      const output = await captureStdout(() =>
        packCreate.run({
          subcommands: [pkgName],
          flags: [{ flag: "--global", value: "true" }],
          context: { root: testRoot },
        }),
      );

      assert(output.includes("Created package: create-glob-msg (global)")).true();
      assert(output.includes("location:")).true();
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });

  test.case("errors on duplicate global package name", async assert => {
    const pkgName = "create-glob-dup";
    await reset();
    await saveGlobalState();
    try {
      // Create the global package once
      await packCreate.run({
        subcommands: [pkgName],
        flags: [{ flag: "--global", value: "true" }],
        context: { root: testRoot },
      });

      // Attempt to create it again
      let threw;
      try {
        await packCreate.run({
          subcommands: [pkgName],
          flags: [{ flag: "--global", value: "true" }],
          context: { root: testRoot },
        });
      } catch (e: unknown) {
        assert(e instanceof CodeError).true();
        threw = (e as CodeError).code;
      }
      assert(threw).equals(PackErrorCode.package_already_exists);
    } finally {
      await restoreGlobalState([pkgName]);
    }

    await testRoot.remove();
  });

  // NOTE: Testing `global_not_writable` is intentionally omitted because it
  // requires making GLOBAL_ROOT (~/.powerups) unwritable, which is fragile
  // across environments and risks clobbering the user's home directory.
  // The error path is a simple try/catch around fs.create(globalRoot).
});