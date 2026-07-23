import test from "@rcompat/test";
import { CodeError } from "@rcompat/error";
import { PackErrorCode } from "#errors/packErrors";
import power_errors from "#errors/powerErrors";
import {
  checkCycle,
  collectSubPowerUps,
  type CollectDeps,
  type CollectedSubPowerUp,
} from "#utils/move/collect";
import type { Instructions } from "#schemas/instruction";
import type { ResolvedPowerUp } from "#utils/resolve-powerup";
import type { FileRef } from "@rcompat/fs";

// ---------------------------------------------------------------------------
// checkCycle — pure
// ---------------------------------------------------------------------------

test.group("checkCycle", () => {
  test.case("returns a new stack with name appended when no cycle", async assert => {
    const result = checkCycle({ pathStack: ["a", "b"], name: "c" });
    assert(result).equals(["a", "b", "c"]);
  });

  test.case("does not mutate the original stack", async assert => {
    const original = ["a", "b"];
    checkCycle({ pathStack: original, name: "c" });
    assert(original).equals(["a", "b"]);
  });

  test.case("throws circular_include when name is already in stack", async assert => {
    let threw;
    try {
      checkCycle({ pathStack: ["a", "b", "a"], name: "a" });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.circular_include);
  });

  test.case("allows empty stack", async assert => {
    const result = checkCycle({ pathStack: [], name: "first" });
    assert(result).equals(["first"]);
  });
});

// ---------------------------------------------------------------------------
// collectSubPowerUps — with stub deps (no filesystem)
// ---------------------------------------------------------------------------

/**
 * Build stub CollectDeps from in-memory maps.
 * - instructionsMap: keyed by a synthetic folder path string
 * - resolvedMap: keyed by powerup name
 */
function makeStubDeps(
  instructionsMap: Map<string, Instructions>,
  resolvedMap: Map<string, ResolvedPowerUp>,
): CollectDeps {
  return {
    readInstructions: async (folder) => {
      const key = folder.path;
      const instr = instructionsMap.get(key);
      if (instr === undefined) {
        throw new Error(`stub: no instructions for ${key}`);
      }
      return instr;
    },
    resolve: async ({ name }) => {
      const resolved = resolvedMap.get(name);
      if (resolved === undefined) {
        // Mimic resolvePowerUp's not_found error
        throw power_errors.not_found(name);
      }
      return resolved;
    },
  };
}

function makeInstructions(includes?: { name: string }[]): Instructions {
  return {
    name: "test",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [],
    ...(includes !== undefined
      ? { includes: includes.map(i => ({ name: i.name, variables: {} })) }
      : {}),
  } as unknown as Instructions;
}

function makeFolder(path: string): FileRef {
  return { path } as FileRef;
}

function makeResolved(name: string, type: "multi-use" | "single-use"): ResolvedPowerUp {
  return {
    type,
    folder: makeFolder(`/fake/${name}`),
    packageName: "fake-pkg",
    location: "local",
  };
}

test.group("collectSubPowerUps (stub deps)", () => {
  test.case("returns empty map when powerup has no includes", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions()],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>();
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    const result = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });

    assert(result.size).equals(0);
  });

  test.case("collects direct includes", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions([{ name: "sub-a" }, { name: "sub-b" }])],
      ["/fake/sub-a", makeInstructions()],
      ["/fake/sub-b", makeInstructions()],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>([
      ["sub-a", makeResolved("sub-a", "multi-use")],
      ["sub-b", makeResolved("sub-b", "single-use")],
    ]);
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    const result = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });

    assert(result.size).equals(2);
    assert(result.get("sub-a")?.parent).equals("root-power");
    assert(result.get("sub-a")?.type).equals("multi-use");
    assert(result.get("sub-b")?.parent).equals("root-power");
    assert(result.get("sub-b")?.type).equals("single-use");
  });

  test.case("collects nested (transitive) includes", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions([{ name: "sub-a" }])],
      ["/fake/sub-a", makeInstructions([{ name: "sub-b" }])],
      ["/fake/sub-b", makeInstructions()],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>([
      ["sub-a", makeResolved("sub-a", "multi-use")],
      ["sub-b", makeResolved("sub-b", "multi-use")],
    ]);
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    const result = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });

    assert(result.size).equals(2);
    // sub-b's parent should be sub-a (the one that included it)
    assert(result.get("sub-b")?.parent).equals("sub-a");
  });

  test.case("deduplicates sub-powerup included by multiple parents", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions([{ name: "sub-a" }, { name: "shared" }])],
      ["/fake/sub-a", makeInstructions([{ name: "shared" }])],
      ["/fake/shared", makeInstructions()],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>([
      ["sub-a", makeResolved("sub-a", "multi-use")],
      ["shared", makeResolved("shared", "multi-use")],
    ]);
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    const result = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });

    // shared should only appear once — first encountered wins
    assert(result.size).equals(2);
    assert(result.has("shared")).true();
    // shared was first included by sub-a (traversed before root's direct ref)
    assert(result.get("shared")?.parent).equals("sub-a");
  });

  test.case("throws circular_include on cycle", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/power-a", makeInstructions([{ name: "power-b" }])],
      ["/fake/power-b", makeInstructions([{ name: "power-a" }])],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>([
      ["power-a", makeResolved("power-a", "multi-use")],
      ["power-b", makeResolved("power-b", "multi-use")],
    ]);
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    let threw;
    try {
      await collectSubPowerUps({
        root: makeFolder("/fake-root"),
        powerupsName: "power-a",
        powerupsFolder: makeFolder("/fake/power-a"),
        pathStack: [],
        deps,
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.circular_include);
  });

  test.case("throws subpower_unresolvable when resolve fails with not_found", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions([{ name: "ghost" }])],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>(); // ghost not resolvable
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    let threw;
    try {
      await collectSubPowerUps({
        root: makeFolder("/fake-root"),
        powerupsName: "root-power",
        powerupsFolder: makeFolder("/fake/root-power"),
        pathStack: [],
        deps,
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(PackErrorCode.subpower_unresolvable);
  });

  test.case("returns a new map each call (no shared mutation)", async assert => {
    const instructionsMap = new Map<string, Instructions>([
      ["/fake/root-power", makeInstructions([{ name: "sub-a" }])],
      ["/fake/sub-a", makeInstructions()],
    ]);
    const resolvedMap = new Map<string, ResolvedPowerUp>([
      ["sub-a", makeResolved("sub-a", "multi-use")],
    ]);
    const deps = makeStubDeps(instructionsMap, resolvedMap);

    const result1 = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });
    const result2 = await collectSubPowerUps({
      root: makeFolder("/fake-root"),
      powerupsName: "root-power",
      powerupsFolder: makeFolder("/fake/root-power"),
      pathStack: [],
      deps,
    });

    // Mutating one should not affect the other
    result1.set("extra", {} as CollectedSubPowerUp);
    assert(result2.has("extra")).false();
    assert(result1.size).equals(2);
    assert(result2.size).equals(1);
  });
});