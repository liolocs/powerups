import preview_errors, { PreviewErrorCode } from "#errors/previewErrors";
import test from "#test-utils/test/index";

test.case("instructions_not_found points at the powerup root", async assert => {
  try {
    throw preview_errors.instructions_not_found("/some/root");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(PreviewErrorCode.instructions_not_found);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("index.ts");
  }
});

test.case("preview_json_invalid includes the detail", async assert => {
  try {
    throw preview_errors.preview_json_invalid("Unexpected token }");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(PreviewErrorCode.preview_json_invalid);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("Unexpected token }");
  }
});

test.case("missing_variables lists the missing and required variables", async assert => {
  try {
    throw preview_errors.missing_variables(["appName"], ["appName", "theme"]);
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(PreviewErrorCode.missing_variables);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("appName");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("Required");
  }
});
