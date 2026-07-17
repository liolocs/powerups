import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import update from "#commands/update/index";
import gain from "#commands/gain/index";
import { CodeError } from "@rcompat/error";
import { GainErrorCode } from "#errors/gainErrors";
import { UpdateErrorCode } from "#errors/updateErrors";
import { MAIN_FOLDER, CLI_NAME, CONFIG_FILE } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

/** Run gain to set up a ${MAIN_FOLDER}} project, then return. */
async function setup(
  harness: string,
  context?: { root?: typeof testRoot; skipGlobal?: boolean },
) {
  await gain.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: harness }],
    context: { root: testRoot, ...context },
  });
}

test.case("update regenerates skill files from config harness", async assert => {
  await reset();
  await setup("pi");

  // Corrupt a skill file
  const skillPath = `.pi/skills/${CLI_NAME}-implement.md`;
  const skillRef = testRoot.append(`/${skillPath}`);
  await skillRef.write("CORRUPTED");

  // Run update — should regenerate the file from the scaffold
  await update.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  const content = await skillRef.text();
  assert(content.includes("CORRUPTED")).equals(false);
  assert(content.startsWith("---\n")).equals(true);
  assert(content.includes(`name: ${CLI_NAME}-implement`)).equals(true);

  await testRoot.remove();
});

test.case("update regenerates instruction section in-place", async assert => {
  await reset();
  await setup("claude");

  // The CLAUDE.md should have the BEGIN/END section
  const agentsRef = testRoot.append("/CLAUDE.md");
  const before = await agentsRef.text();
  assert(before.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  // Run update
  await update.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  // Section should still be there exactly once (not duplicated)
  const after = await agentsRef.text();
  const count = (after.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("update --harness overrides config and persists", async assert => {
  await reset();
  await setup("pi");

  // Update with a different harness
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  // Claude files should now exist
  assert(await fs.exists(testRoot.append(`/.claude/skills`))).equals(true);
  // Config should be updated to claude
  const config = JSON.parse(
    await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).text(),
  );
  assert(config.harness).equals("claude");

  await testRoot.remove();
});

test.case("update fails when not initialized", async assert => {
  await reset();

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(GainErrorCode.dry_folder_not_found);

  await testRoot.remove();
});

test.case("update fails when no config and no --harness", async assert => {
  await reset();
  await setup("pi");

  // Remove the config file to simulate a project without persisted harness
  await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).remove();

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.no_harness_config);

  await testRoot.remove();
});

test.case("update succeeds with --harness when no config exists", async assert => {
  await reset();
  await setup("pi");

  // Remove the config file
  await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).remove();

  // Update with --harness should still work and write config
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  // Config should now exist with claude
  const config = JSON.parse(
    await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).text(),
  );
  assert(config.harness).equals("claude");

  await testRoot.remove();
});

test.case("update fails with invalid --harness", async assert => {
  await reset();
  await setup("pi");

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "bogus" }],
      context: { root: testRoot },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(GainErrorCode.invalid_harness);

  // Config should NOT have been overwritten with the invalid value
  const config = JSON.parse(
    await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).text(),
  );
  assert(config.harness).equals("pi");

  await testRoot.remove();
});

test.case("update does not overwrite config when no --harness passed", async assert => {
  await reset();
  await setup("pi");

  // Touch the config to record its modification time content
  const configBefore = await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).text();

  await update.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  });

  const configAfter = await testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).text();
  assert(configAfter).equals(configBefore);

  await testRoot.remove();
});