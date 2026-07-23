import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import update from "#commands/update/index";
import init from "#commands/init/index";
import { CodeError } from "@rcompat/error";
import { InitErrorCode } from "#errors/initErrors";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

/** Run init globally to set up ~/.powerups, then return. */
async function setup(
  harness: string,
) {
  await init.run({
    subcommands: [harness],
    flags: [],
    context: { homeDir: testRoot.path },
  });
}

test.case("update regenerates skill files globally", async assert => {
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
    context: { homeDir: testRoot.path },
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
    context: { homeDir: testRoot.path },
  });

  // Section should still be there exactly once (not duplicated)
  const after = await agentsRef.text();
  const count = (after.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("update --harness scaffolds to specified harness only", async assert => {
  await reset();
  await setup("pi");

  // Update with a different harness
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { homeDir: testRoot.path },
  });

  // Claude files should now exist
  assert(await fs.exists(testRoot.append(`/.claude/skills`))).equals(true);

  await testRoot.remove();
});

test.case("update fails when not initialized globally", async assert => {
  await reset();

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(InitErrorCode.global_not_initialized);

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
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(InitErrorCode.invalid_harness);

  await testRoot.remove();
});

test.case("update scaffolds to all detected harnesses", async assert => {
  await reset();
  // Create global fingerprints for both claude and pi
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi/agent"));

  // First init with claude only
  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // Now update without --harness — should scaffold to all detected
  await update.run({
    subcommands: [],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // Both should get scaffolded
  assert(await fs.exists(testRoot.append("/.claude/skills"))).equals(true);
  assert(await fs.exists(testRoot.append("/.pi/skills"))).equals(true);

  await testRoot.remove();
});