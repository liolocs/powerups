import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { readConfig, writeConfig, readGlobalConfig } from "#utils/config";
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