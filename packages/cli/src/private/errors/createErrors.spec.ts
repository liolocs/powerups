import create_errors, { CreateErrorCode } from "#errors/createErrors";
import test from "#test-utils/test/index";

test.case("invalid_capture error contains the invalid value and usage instructions", async assert => {
  try {
    throw create_errors.invalid_capture("bad-value");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.invalid_capture);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("bad-value");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("--capture=<all|workingDir>");
  }
});

test.case("missing_description error contains usage instructions", async assert => {
  try {
    throw create_errors.missing_description();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.missing_description);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("--description");
  }
});

test.case("global_root_not_found error mentions --local alternative", async assert => {
  try {
    throw create_errors.global_root_not_found();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.global_root_not_found);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("--local");
  }
});

test.case("missing_name still works", async assert => {
  try {
    throw create_errors.missing_name();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.missing_name);
  }
});

test.case("already_exists still works", async assert => {
  try {
    throw create_errors.already_exists("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.already_exists);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
  }
});

test.case("main_folder_not_found still works", async assert => {
  try {
    throw create_errors.main_folder_not_found();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(CreateErrorCode.main_folder_not_found);
  }
});