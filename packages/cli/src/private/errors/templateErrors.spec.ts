import template_errors, { TemplateErrorCode } from "#errors/templateErrors";
import test from "#test-utils/test/index";

test.case("steps_region_invalid includes the detail", async assert => {
  try {
    throw template_errors.steps_region_invalid("the array is not valid JSON");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.steps_region_invalid);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("not valid JSON");
  }
});

test.case("step_not_found includes the output path", async assert => {
  try {
    throw template_errors.step_not_found("package.json");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.step_not_found);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("package.json");
  }
});

test.case("already_dynamic suggests --revert", async assert => {
  try {
    throw template_errors.already_dynamic("package.json");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.already_dynamic);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("--revert");
  }
});

test.case("not_dynamic explains the step is static", async assert => {
  try {
    throw template_errors.not_dynamic("package.json");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.not_dynamic);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("static");
  }
});

test.case("revert_needs_variables lists the missing variables", async assert => {
  try {
    throw template_errors.revert_needs_variables(["name", "theme"]);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.revert_needs_variables);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("name, theme");
  }
});

test.case("invalid_engine includes the bad value", async assert => {
  try {
    throw template_errors.invalid_engine("yaml");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(TemplateErrorCode.invalid_engine);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("yaml");
  }
});
