import test from "#test-utils/test/index";
import install_errors, { InstallErrorCode } from "#errors/installErrors";

test.case("should include the install command name in missing_source usage hint", async assert => {
  try {
    throw install_errors.missing_source();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.missing_source);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("install");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("npm:");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("git:");
  }
});

test.case("should include the powerup name in internal_not_installable error", async assert => {
  try {
    throw install_errors.internal_not_installable("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.internal_not_installable);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup create");
  }
});

test.case("should include the powerup name in global_internal_not_installable error", async assert => {
  try {
    throw install_errors.global_internal_not_installable("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.global_internal_not_installable);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
  }
});

test.case("should include the source and message in fetch_failed error", async assert => {
  try {
    throw install_errors.fetch_failed("npm:bad-package", "network error");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.fetch_failed);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("npm:bad-package");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("network error");
  }
});

test.case("should include the source, stale package and uninstall hint in stale_npm_package error", async assert => {
  try {
    throw install_errors.stale_npm_package({ source: "npm:@liolocs/foo", stalePackage: "powerup-hello-world" });
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.stale_npm_package);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("npm:@liolocs/foo");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("powerup-hello-world");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup uninstall npm:powerup-hello-world");
  }
});

test.case("should include the source and reason in not_a_powerups_package error", async assert => {
  try {
    throw install_errors.not_a_powerups_package("npm:bad-package", "Missing powerups-package keyword");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.not_a_powerups_package);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("npm:bad-package");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("Missing powerups-package keyword");
  }
});

test.case("should include the powerup name in already_installed error", async assert => {
  try {
    throw install_errors.already_installed("my-powerup");
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals(InstallErrorCode.already_installed);
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("my-powerup");
    // @ts-expect-error error.message is not typed on unknown
    assert(error.message).includes("pup use");
  }
});