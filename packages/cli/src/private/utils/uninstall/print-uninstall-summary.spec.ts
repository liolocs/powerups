import test from "#test-utils/test/index";
import printUninstallSummary from "#utils/uninstall/print-uninstall-summary";

test.case("should run without error in non-dry-run mode", async assert => {
  printUninstallSummary({
    powerupName: "my-powerup",
    source: "npm:@liolocs/my-powerup",
    isLocal: false,
    storeType: "npm",
    isDryRun: false,
    removedPath: "/path/to/removed",
  });

  assert(true).true();
});

test.case("should run without error in dry-run mode", async assert => {
  printUninstallSummary({
    powerupName: "my-powerup",
    source: "git:github.com/owner/repo",
    isLocal: true,
    storeType: "git",
    isDryRun: true,
    removedPath: "/path/to/removed",
  });

  assert(true).true();
});