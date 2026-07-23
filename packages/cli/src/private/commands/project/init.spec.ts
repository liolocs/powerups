import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import projectInit from "#commands/project/init";
import { CodeError } from "@rcompat/error";
import { ProjectErrorCode } from "#errors/projectErrors";
import captureStdout from "#test-utils/capture-stdout";
import { MAIN_FOLDER, CLI_NAME, CONFIG_FILE } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/project-init-spec");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.case("project init creates .powerups folder", async assert => {
  await reset();

  await projectInit.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  assert(await fs.exists(mainFolder)).true();

  await testRoot.remove();
});

test.case("project init writes config.json with empty packages", async assert => {
  await reset();

  await projectInit.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  const configPath = mainFolder.append(`/${CONFIG_FILE}`);
  assert(await fs.exists(configPath)).true();

  const config = await configPath.json() as Record<string, unknown>;
  assert(config.packages).equals([]);

  await testRoot.remove();
});

test.case("project init config.json has no harness field", async assert => {
  await reset();

  await projectInit.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  const configPath = mainFolder.append(`/${CONFIG_FILE}`);
  const config = await configPath.json() as Record<string, unknown>;

  assert("harness" in config).false();

  await testRoot.remove();
});

test.case("project init throws when folder already exists", async assert => {
  await reset();

  // Pre-create the folder so it already exists
  await fs.create(mainFolder);

  let threw;
  try {
    await projectInit.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(ProjectErrorCode.project_already_initialized);

  await testRoot.remove();
});

test.case("project init prints success message", async assert => {
  await reset();

  const output = await captureStdout(() =>
    projectInit.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }),
  );

  assert(output.includes("Initialized")).true();
  assert(output.includes(CLI_NAME)).true();

  await testRoot.remove();
});