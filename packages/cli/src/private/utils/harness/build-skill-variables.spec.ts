import test from "#test-utils/test/index";
import buildSkillVariables from "#utils/harness/build-skill-variables";

test.case("should return the CLI skill variables", async assert => {
  const variables = buildSkillVariables();

  assert(variables.CLI_CMD).equals("pup");
  assert(variables.CLI_FOLDER_NAME).equals(".powerups");
  assert(variables.INTERNAL_FOLDER).equals("_internal");
  assert(variables.SINGULAR_NAME_FOR_CLI).equals("powerup");
});