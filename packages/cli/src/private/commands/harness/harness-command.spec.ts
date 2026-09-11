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