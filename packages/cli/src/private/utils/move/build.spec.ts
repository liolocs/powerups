import test from "@rcompat/test";
import {
  buildUpdatedPowerups,
  buildGlobalPackageJson,
} from "#utils/move/build";
import { MULTI_USE_FOLDER, SINGLE_USE_FOLDER, CLI_NAME } from "#constants";
import type { CollectedSubPowerUp } from "#utils/move/collect";

function makeCollected(
  entries: { name: string; parent: string; type: "multi-use" | "single-use" }[],
): Map<string, CollectedSubPowerUp> {
  const map = new Map<string, CollectedSubPowerUp>();
  for (const e of entries) {
    map.set(e.name, {
      folder: {} as never, // unused by buildUpdatedPowerups
      type: e.type,
      parent: e.parent,
    });
  }
  return map;
}

test.group("buildUpdatedPowerups", () => {
  test.case("clones existing active entries", async assert => {
    const activeRecord: Record<string, Record<string, string>> = {
      [MULTI_USE_FOLDER]: { "power-a": "./some/path" },
      [SINGLE_USE_FOLDER]: {},
    };

    const result = buildUpdatedPowerups({ activeRecord, collected: new Map() });
    const active = result.active as Record<string, Record<string, string>>;

    assert(active[MULTI_USE_FOLDER]["power-a"]).equals("./some/path");
    assert(active[SINGLE_USE_FOLDER]).equals({});
  });

  test.case("does not mutate the original active record", async assert => {
    const activeRecord: Record<string, Record<string, string>> = {
      [MULTI_USE_FOLDER]: { "power-a": "./some/path" },
      [SINGLE_USE_FOLDER]: {},
    };

    buildUpdatedPowerups({ activeRecord, collected: new Map() });

    // Original should be unchanged — no parent:child keys added
    assert(Object.keys(activeRecord[MULTI_USE_FOLDER])).equals(["power-a"]);
  });

  test.case("adds parent:child entries for collected sub-powerups", async assert => {
    const activeRecord: Record<string, Record<string, string>> = {
      [MULTI_USE_FOLDER]: { "power-a": "./src/active/multi-use/power-a/instructions.json" },
      [SINGLE_USE_FOLDER]: {},
    };

    const collected = makeCollected([
      { name: "sub-1", parent: "power-a", type: "multi-use" },
      { name: "sub-2", parent: "power-a", type: "single-use" },
    ]);

    const result = buildUpdatedPowerups({ activeRecord, collected });
    const active = result.active as Record<string, Record<string, string>>;

    assert(active[MULTI_USE_FOLDER]["power-a:sub-1"]).equals(
      "./src/active/multi-use/sub-1/instructions.json",
    );
    assert(active[SINGLE_USE_FOLDER]["power-a:sub-2"]).equals(
      "./src/active/single-use/sub-2/instructions.json",
    );
  });

  test.case("handles empty active record and empty collected", async assert => {
    const activeRecord: Record<string, Record<string, string>> = {
      [MULTI_USE_FOLDER]: {},
      [SINGLE_USE_FOLDER]: {},
    };

    const result = buildUpdatedPowerups({ activeRecord, collected: new Map() });
    const active = result.active as Record<string, Record<string, string>>;

    assert(active[MULTI_USE_FOLDER]).equals({});
    assert(active[SINGLE_USE_FOLDER]).equals({});
  });

  test.case("defaults missing type folders to empty objects", async assert => {
    const activeRecord: Record<string, Record<string, string>> = {};

    const result = buildUpdatedPowerups({ activeRecord, collected: new Map() });
    const active = result.active as Record<string, Record<string, string>>;

    assert(active[MULTI_USE_FOLDER]).equals({});
    assert(active[SINGLE_USE_FOLDER]).equals({});
  });
});

test.group("buildGlobalPackageJson", () => {
  test.case("spreads local pkg json and overrides powerups", async assert => {
    const localPkgJson = {
      name: "my-pkg",
      version: "1.0.0",
      description: "test",
      keywords: ["powerups-package"],
      [CLI_NAME]: {
        active: {
          [MULTI_USE_FOLDER]: {},
          [SINGLE_USE_FOLDER]: {},
        },
      },
    } as never;

    const updatedPowerups = {
      active: {
        [MULTI_USE_FOLDER]: { "power-a": "./path" },
        [SINGLE_USE_FOLDER]: {},
      },
    } as never;

    const result = buildGlobalPackageJson({
      localPkgJson,
      updatedPowerups,
    }) as Record<string, unknown>;

    assert(result.name).equals("my-pkg");
    assert(result.version).equals("1.0.0");
    assert(result.keywords).equals(["powerups-package"]);
    assert(result[CLI_NAME]).equals(updatedPowerups);
  });

  test.case("does not mutate the original local pkg json", async assert => {
    const localPkgJson = {
      name: "my-pkg",
      version: "1.0.0",
      description: "test",
      keywords: ["powerups-package"],
      [CLI_NAME]: { active: {} },
    } as never;

    const updatedPowerups = { active: {} } as never;

    buildGlobalPackageJson({ localPkgJson, updatedPowerups });

    // Original powerups property should be unchanged
    const original = localPkgJson as Record<string, unknown>;
    assert(original[CLI_NAME]).equals({ active: {} });
  });
});