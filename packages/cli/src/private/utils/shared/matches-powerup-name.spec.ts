import test from "#test-utils/test/index";
import matchesPowerupName from "#utils/shared/matches-powerup-name";
import type { PackageEntry } from "@liolocs/powerups-sdk";

test.case("should match a string entry by its name part", async assert => {
  const entry: PackageEntry = "internal:my-powerup";
  assert(matchesPowerupName(entry, "my-powerup")).true();
  assert(matchesPowerupName(entry, "internal:my-powerup")).true();
  assert(matchesPowerupName(entry, "other")).false();
});

test.case("should match a named object entry by its powerup name", async assert => {
  const entry: PackageEntry = { package: "npm:@liolocs/pkg", name: "my-powerup" };
  assert(matchesPowerupName(entry, "my-powerup")).true();
  // and by its full source
  assert(matchesPowerupName(entry, "npm:@liolocs/pkg")).true();
  // and by its scoped package name
  assert(matchesPowerupName(entry, "@liolocs/pkg")).true();
  assert(matchesPowerupName(entry, "my-other-powerup")).false();
});

test.case("should match a legacy unnamed object entry by its package name part", async assert => {
  const entry: PackageEntry = { package: "npm:my-powerup" };
  assert(matchesPowerupName(entry, "my-powerup")).true();
  assert(matchesPowerupName(entry, "npm:my-powerup")).true();
  assert(matchesPowerupName(entry, "other")).false();
});

test.case("should not match a plain powerup name against another package's source", async assert => {
  const entry: PackageEntry = { package: "npm:@liolocs/pkg", name: "my-powerup" };
  // a plain name that happens to equal another entry's scoped name should not
  // collide via the name path
  assert(matchesPowerupName(entry, "another-powerup")).false();
});

test.case("should match a git entry by its full source", async assert => {
  const entry: PackageEntry = { package: "git:github.com/owner/repo", name: "repo" };
  assert(matchesPowerupName(entry, "repo")).true();
  assert(matchesPowerupName(entry, "git:github.com/owner/repo")).true();
});