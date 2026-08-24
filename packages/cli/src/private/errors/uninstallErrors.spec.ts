import test from "#test-utils/test/index";
import uninstall_errors, { UninstallErrorCode } from "#errors/uninstallErrors";

test.case("should include the uninstall command name in missing_name usage hint", async assert => {
  try {
    throw uninstall_errors.missing_name();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(UninstallErrorCode.missing_name);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("uninstall");
  }
});

test.case("should include the powerup name in not_installed error", async assert => {
  try {
    throw uninstall_errors.not_installed("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(UninstallErrorCode.not_installed);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("install");
  }
});

test.case("should include the powerup name in internal_not_uninstallable error", async assert => {
  try {
    throw uninstall_errors.internal_not_uninstallable("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(UninstallErrorCode.internal_not_uninstallable);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup create");
  }
});