import test from "#test-utils/test/index";
import loadHarnessSkills from "#utils/harness/load-harness-skills";

test.case("builtin harness-skills resolves", async assert => {
  const { instructions, location, version } = await loadHarnessSkills();

  assert(instructions.name).equals("harness-skills");
  assert(version).equals("1.0.0");
  assert(location.path).includes("harness-skills");
});

test.case("builtin has one dynamic-create step for the create-powerup skill", async assert => {
  const { instructions } = await loadHarnessSkills();

  assert(instructions.steps.length).equals(1);

  const step = instructions.steps[0] as {
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