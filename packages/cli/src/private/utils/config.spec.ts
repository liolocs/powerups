import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import {
  readConfig,
  writeConfig,
  readGlobalConfig,
  normalizePackageEntry,
  getPackageSource,
  addPackageToConfig,
  removePackageFromConfig,
  type PackageEntry,
} from "#utils/config";
import { MAIN_FOLDER, CONFIG_FILE } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.group("readConfig", () => {
  test.case("should return null when config file does not exist", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));

    const config = await readConfig(testRoot);
    assert(config).equals(null);

    await testRoot.remove();
  });

  test.case(`should return null when ${MAIN_FOLDER} folder does not exist`, async assert => {
    await reset();

    const config = await readConfig(testRoot);
    assert(config).equals(null);

    await testRoot.remove();
  });

  test.case("should read harness from config file", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .write(JSON.stringify({ harness: "pi" }));

    const config = await readConfig(testRoot);
    assert(config?.harness).equals("pi");

    await testRoot.remove();
  });

  test.case("should read packages array from config file", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .write(JSON.stringify({ harness: "pi", packages: ["my-pkg", "other-pkg"] }));

    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["my-pkg", "other-pkg"]);

    await testRoot.remove();
  });

  test.case("should read packages array with object entries from config file", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    const entry: PackageEntry = { package: "npm:other", powerups: { include: ["a"] } };
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .write(JSON.stringify({ harness: "pi", packages: ["my-pkg", entry] }));

    const config = await readConfig(testRoot);
    assert(config?.packages[0]).equals("my-pkg");
    assert(getPackageSource(config!.packages[1])).equals("npm:other");

    await testRoot.remove();
  });

  test.case("should return empty packages array when not in config", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .write(JSON.stringify({ harness: "pi" }));

    const config = await readConfig(testRoot);
    assert(config?.packages).equals([]);

    await testRoot.remove();
  });
});

test.group("writeConfig", () => {
  test.case("should write config file with harness", async assert => {
    await reset();

    await writeConfig(testRoot, { harness: "claude", packages: [] });

    const configPath = testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);
    assert(await fs.exists(configPath)).equals(true);

    const config = await readConfig(testRoot);
    assert(config?.harness).equals("claude");

    await testRoot.remove();
  });

  test.case("should overwrite existing config file", async assert => {
    await reset();
    await writeConfig(testRoot, { harness: "pi", packages: [] });
    await writeConfig(testRoot, { harness: "claude", packages: [] });

    const config = await readConfig(testRoot);
    assert(config?.harness).equals("claude");

    await testRoot.remove();
  });

  test.case("should write config file with packages array", async assert => {
    await reset();

    await writeConfig(testRoot, { harness: "claude", packages: ["my-pkg"] });

    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["my-pkg"]);

    await testRoot.remove();
  });
});

test.group("readGlobalConfig", () => {
  test.case("should return empty packages array when global config does not exist or is missing packages", async assert => {
    const config = await readGlobalConfig();
    assert(config).defined();
    assert(Array.isArray(config.packages)).true();
  });
});

test.group("normalizePackageEntry", () => {
  test.case("normalizes a plain string into { package }", assert => {
    assert(normalizePackageEntry("npm:pkg")).equals({ package: "npm:pkg" });
  });

  test.case("passes through an object entry with a shallow powerups copy", assert => {
    const entry: PackageEntry = {
      package: "npm:pkg",
      powerups: { include: ["a"], exclude: ["b"] },
    };
    const normalized = normalizePackageEntry(entry);
    assert(normalized).equals({
      package: "npm:pkg",
      powerups: { include: ["a"], exclude: ["b"] },
    });
  });

  test.case("normalizes an object without powerups", assert => {
    assert(normalizePackageEntry({ package: "npm:pkg" })).equals({ package: "npm:pkg" });
  });
});

test.group("getPackageSource", () => {
  test.case("returns the string for a plain string entry", assert => {
    assert(getPackageSource("npm:pkg")).equals("npm:pkg");
  });

  test.case("returns .package for an object entry", assert => {
    assert(getPackageSource({ package: "npm:pkg", powerups: { include: ["a"] } }))
      .equals("npm:pkg");
  });
});

test.group("addPackageToConfig", () => {
  test.case("adds a plain string entry to config", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .writeJSON({ harness: "pi", packages: [] });

    await addPackageToConfig(testRoot, "npm:pkg");
    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["npm:pkg"]);

    await testRoot.remove();
  });

  test.case("adds an object entry with a powerups filter", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .writeJSON({ harness: "pi", packages: [] });

    const entry: PackageEntry = { package: "npm:pkg", powerups: { include: ["a"] } };
    await addPackageToConfig(testRoot, entry);
    const config = await readConfig(testRoot);
    assert(getPackageSource(config!.packages[0])).equals("npm:pkg");
    assert(config?.packages[0]).equals(entry);

    await testRoot.remove();
  });

  test.case("updates an existing entry with the same source (dedup)", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .writeJSON({ harness: "pi", packages: ["npm:pkg"] });

    const entry: PackageEntry = { package: "npm:pkg", powerups: { include: ["a"] } };
    await addPackageToConfig(testRoot, entry);
    const config = await readConfig(testRoot);
    assert(config?.packages.length).equals(1);
    assert(config?.packages[0]).equals(entry);

    await testRoot.remove();
  });
});

test.group("removePackageFromConfig", () => {
  test.case("removes a plain string entry by source", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .writeJSON({ harness: "pi", packages: ["npm:pkg", "other"] });

    await removePackageFromConfig(testRoot, "npm:pkg");
    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["other"]);

    await testRoot.remove();
  });

  test.case("removes an object entry by matching source", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${MAIN_FOLDER}`));
    const entry: PackageEntry = { package: "npm:pkg", powerups: { include: ["a"] } };
    await testRoot
      .append(`/${MAIN_FOLDER}/${CONFIG_FILE}`)
      .writeJSON({ harness: "pi", packages: [entry, "other"] });

    await removePackageFromConfig(testRoot, "npm:pkg");
    const config = await readConfig(testRoot);
    assert(config?.packages).equals(["other"]);

    await testRoot.remove();
  });
});