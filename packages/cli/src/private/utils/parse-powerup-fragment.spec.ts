import test from "@rcompat/test";
import {
  parseFragment,
  mergeFilters,
  buildConfigEntry,
} from "#utils/parse-powerup-fragment";

test.group("parseFragment", () => {
  test.case("returns empty filter when no fragment", assert => {
    assert(parseFragment("npm:react-powerups"))
      .equals({ source: "npm:react-powerups", filter: {} });
  });

  test.case("parses include fragment", assert => {
    assert(parseFragment("npm:react-powerups#use-form"))
      .equals({ source: "npm:react-powerups", filter: { include: ["use-form"] } });
  });

  test.case("parses exclude fragment", assert => {
    assert(parseFragment("npm:react-powerups#!use-form,use-filter"))
      .equals({ source: "npm:react-powerups", filter: { exclude: ["use-form", "use-filter"] } });
  });

  test.case("parses multiple includes", assert => {
    assert(parseFragment("npm:pkg#a,b,c").filter)
      .equals({ include: ["a", "b", "c"] });
  });

  test.case("parses git url with fragment", assert => {
    assert(parseFragment("https://github.com/foo/bar#!x").filter)
      .equals({ exclude: ["x"] });
  });
});

test.group("mergeFilters", () => {
  test.case("merges fragment include with flag include", assert => {
    assert(mergeFilters({ include: ["a"] }, "b,c", undefined))
      .equals({ include: ["a", "b", "c"] });
  });

  test.case("merges fragment exclude with flag exclude", assert => {
    assert(mergeFilters({ exclude: ["x"] }, undefined, "y,z"))
      .equals({ exclude: ["x", "y", "z"] });
  });

  test.case("dedups overlapping names", assert => {
    assert(mergeFilters({ include: ["a"] }, "a,b"))
      .equals({ include: ["a", "b"] });
  });

  test.case("returns empty filter when nothing specified", assert => {
    assert(mergeFilters({})).equals({});
  });
});

test.group("buildConfigEntry", () => {
  test.case("returns plain string when no filter", assert => {
    assert(buildConfigEntry("npm:pkg", {})).equals("npm:pkg");
  });

  test.case("returns object with include", assert => {
    assert(buildConfigEntry("npm:pkg", { include: ["a"] }))
      .equals({ package: "npm:pkg", powerups: { include: ["a"] } });
  });

  test.case("returns object with include and exclude", assert => {
    assert(buildConfigEntry("npm:pkg", { include: ["a"], exclude: ["b"] }))
      .equals({ package: "npm:pkg", powerups: { include: ["a"], exclude: ["b"] } });
  });

  test.case("returns object with exclude only", assert => {
    assert(buildConfigEntry("npm:pkg", { exclude: ["b"] }))
      .equals({ package: "npm:pkg", powerups: { exclude: ["b"] } });
  });
});