import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import init from "#commands/harness/init";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/harness-command");
const homeDir = testRoot.append("/home").path;
const piSkills = () => testRoot.append("/home/.pi/agent/skills");

test.case("init writes the create-powerup skill into the global skills dir", async assert => {
  await fs.create(testRoot);

  await init.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  const skillFile = piSkills().append("/create-powerup/SKILL.md");
  assert(await skillFile.exists()).true();

  const content = await skillFile.text();
  assert(content).includes("name: create-powerup");
  assert(content).includes("pup create");
  assert(content).includes(".powerups");
  assert(content.startsWith("---")).true();

  await testRoot.remove({ recursive: true });
});

test.case("init skips an already-installed skill", async assert => {
  await fs.create(testRoot);
  const skillFile = piSkills().append("/create-powerup/SKILL.md");
  await skillFile.write("user-modified");

  await init.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  assert(await skillFile.text()).equals("user-modified\n");

  await testRoot.remove({ recursive: true });
});

test.case("init dry-run writes nothing", async assert => {
  await fs.create(testRoot);

  await init.run({
    subcommands: ["pi"],
    flags: [{ flag: "--dry-run" }],
    context: { homeDir },
  });

  assert(await testRoot.append("/home/.pi").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("init rejects an invalid harness", async assert => {
  try {
    await init.run({ subcommands: ["nope"], flags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("invalid_harness");
  }
});

test.case("init rejects a missing harness positional", async assert => {
  try {
    await init.run({ subcommands: [], flags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_harness");
  }
});

import update from "#commands/harness/update";
import remove from "#commands/harness/remove";

test.case("update overwrites an installed skill with current content", async assert => {
  await fs.create(testRoot);

  await init.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  const skillFile = piSkills().append("/create-powerup/SKILL.md");
  await skillFile.write("stale content");

  await update.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  const content = await skillFile.text();
  assert(content).includes("name: create-powerup");
  assert(content.includes("stale")).false();

  await testRoot.remove({ recursive: true });
});

test.case("remove deletes the installed skill dir", async assert => {
  await fs.create(testRoot);

  await init.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  const skillDir = piSkills().append("/create-powerup");
  assert(await skillDir.exists()).true();

  await remove.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  assert(await skillDir.exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("remove reports skipped when nothing is installed", async assert => {
  await fs.create(testRoot);

  await remove.run({ subcommands: ["claude"], flags: [], context: { homeDir } });

  assert(await testRoot.append("/home/.claude/skills").exists()).false();

  await testRoot.remove({ recursive: true });
});

test.case("remove dry-run deletes nothing", async assert => {
  await fs.create(testRoot);

  await init.run({ subcommands: ["pi"], flags: [], context: { homeDir } });

  await remove.run({
    subcommands: ["pi"],
    flags: [{ flag: "--dry-run" }],
    context: { homeDir },
  });

  assert(await piSkills().append("/create-powerup/SKILL.md").exists()).true();

  await testRoot.remove({ recursive: true });
});

import harness from "#commands/harness/index";

test.case("harness requires a subcommand", async assert => {
  try {
    await harness.run({ subcommands: [], flags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("missing_required_subcommand");
  }
});

test.case("harness rejects unknown subcommands", async assert => {
  try {
    await harness.run({ subcommands: ["frobnicate"], flags: [] });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("invalid_subcommand");
  }
});
