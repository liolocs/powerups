import test from "#test-utils/test/index";
import getBuiltInPowerup from "#utils/use/get-powerup/getBuiltInPowerup";

test.case("builtin harness-skills resolves", async assert => {
  const powerup = await getBuiltInPowerup({ name: "harness-skills" });

  assert(powerup.instructions.name).equals("harness-skills");
  assert(powerup.version).equals("1.0.0");
});

test.case("builtin has one dynamic-create step for the create-powerup skill", async assert => {
  const powerup = await getBuiltInPowerup({ name: "harness-skills" });

  assert(powerup.instructions.steps.length).equals(1);

  const step = powerup.instructions.steps[0] as {
    type: string;
    name: string;
    template: string;
    outputPath: string;
  };

  assert(step.type).equals("dynamic-create");
  assert(step.name).equals("create-powerup-skill");
  assert(step.template).equals("src/skills/create-powerup.njk");
  assert(step.outputPath).equals("create-powerup/SKILL.md");
});
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
