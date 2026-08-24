import test from "#test-utils/test/index";
import checkForPreUninstallErrors from "#utils/uninstall/check-for-pre-uninstall-errors/index";
import { UninstallErrorCode } from "#errors/uninstallErrors";

test.case("should throw missing_name when no name is passed", async assert => {
  await assert(checkForPreUninstallErrors({
    name: undefined,
    parsedType: "npm",
  })).throwsAsync(UninstallErrorCode.missing_name);
});

test.case("should throw internal_not_uninstallable when parsed type is internal", async assert => {
  await assert(checkForPreUninstallErrors({
    name: "my-powerup",
    parsedType: "internal",
  })).throwsAsync(UninstallErrorCode.internal_not_uninstallable);
});

test.case("should not throw when name is passed and type is npm", async assert => {
  await assert(checkForPreUninstallErrors({
    name: "my-powerup",
    parsedType: "npm",
  })).noErrorAsync();
});

test.case("should not throw when name is passed and type is git", async assert => {
  await assert(checkForPreUninstallErrors({
    name: "my-powerup",
    parsedType: "git",
  })).noErrorAsync();
});