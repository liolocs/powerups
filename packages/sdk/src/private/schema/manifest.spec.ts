import test from "@rcompat/test";
import { manifestLineSchema, manifestSchema } from "#schema/manifest";

const base = {
  powerupName: "react-setup",
  version: "1.2.0",
  location: "~/.powerups/stores/npm/react-setup/",
  type: "multi-use" as const,
  timestamp: "2025-01-01T00:00:00.000Z",
  stepName: "create-app",
  stepType: "create" as const,
  status: "applied" as const,
  output: { type: "create", path: "src/App.tsx", action: "create", characterCount: 412 },
};

test.group("manifest line acceptance", () => {
  test.case("accepts a modify output with action=create (file was absent)", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "modify",
      stepName: "wire-router",
      output: { type: "modify", path: "src/index.ts", action: "create", characterCount: 88 },
    });

    assert(result.output.type).equals("modify");
    assert((result.output as any).action).equals("create");
    assert((result.output as any).characterCount).equals(88);
  });

  test.case("accepts a create output with action=modify (overwrite)", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      output: { type: "create", path: "src/App.tsx", action: "modify", characterCount: 500 },
    });

    assert((result.output as any).action).equals("modify");
  });

  test.case("accepts a delete output (path only, no action/characterCount)", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "delete",
      stepName: "remove-legacy",
      output: { type: "delete", path: "src/legacy/config.ts" },
    });

    assert(result.output.type).equals("delete");
    assert((result.output as any).path).equals("src/legacy/config.ts");
    assert((result.output as any).action).undefined();
    assert((result.output as any).characterCount).undefined();
  });

  test.case("accepts an install output with added dependencies", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "install",
      stepName: "install-deps",
      output: {
        type: "install",
        dependencies: ["lodash@^4.0.0"],
        devDependencies: ["vitest"],
        peerDependencies: ["react@^18.0.0"],
      },
    });

    assert(result.output.type).equals("install");
    assert((result.output as any).dependencies).equals(["lodash@^4.0.0"]);
    assert((result.output as any).devDependencies).equals(["vitest"]);
    assert((result.output as any).peerDependencies).equals(["react@^18.0.0"]);
  });

  test.case("accepts an install output with only one dependency section", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "install",
      output: { type: "install", dependencies: ["zod"] },
    });

    assert((result.output as any).dependencies).equals(["zod"]);
    assert((result.output as any).devDependencies).undefined();
    assert((result.output as any).peerDependencies).undefined();
  });

  test.case("accepts an install output with no additions (empty)", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "install",
      output: { type: "install" },
    });

    assert(result.output.type).equals("install");
  });

  test.case("accepts a read output recording the bound variable", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "read",
      stepName: "read-pkg",
      output: { type: "read", variable: "packageName" },
    });

    assert(result.output.type).equals("read");
    assert((result.output as any).variable).equals("packageName");
  });

  test.case("accepts a none output for a skipped-already-applied step", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "create",
      stepName: "already-done",
      status: "skipped-already-applied",
      output: { type: "none" },
    });

    assert(result.status).equals("skipped-already-applied");
    assert(result.output.type).equals("none");
    // stepType is retained at top level even when output is "none"
    assert(result.stepType).equals("create");
  });

  test.case("accepts a none output for a skipped-warning step", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      stepType: "modify",
      status: "skipped-warning",
      output: { type: "none" },
    });

    assert(result.output.type).equals("none");
  });

  test.case("accepts a local (project-relative) location path", assert => {
    const result = manifestLineSchema.parse({ ...base, location: "./powerups/stores/_internal" });

    assert(result.location).equals("./powerups/stores/_internal");
  });

  test.case("accepts from for an included-powerup step", assert => {
    const result = manifestLineSchema.parse({ ...base, from: "cmd" });

    assert(result.from).equals("cmd");
  });

  test.case("from is optional", assert => {
    const result = manifestLineSchema.parse(base);

    assert(result.from).undefined();
  });

  test.case("accepts characterCount of 0 (empty render)", assert => {
    const result = manifestLineSchema.parse({
      ...base,
      output: { type: "create", path: "src/empty.txt", action: "create", characterCount: 0 },
    });

    assert((result.output as any).characterCount).equals(0);
  });

  test.case("accepts single-use type", assert => {
    const result = manifestLineSchema.parse({ ...base, type: "single-use" });

    assert(result.type).equals("single-use");
  });
});

test.group("manifest file (array) acceptance", () => {
  test.case("parses an empty manifest", assert => {
    const result = manifestSchema.parse([]);

    assert(result.length).equals(0);
  });

});

test.group("manifest line rejections", () => {
  const rejects = (label: string, value: unknown) => {
    test.case(`rejects ${label}`, assert => {
      let threw = false;
      try {
        manifestLineSchema.parse(value);
      } catch {
        threw = true;
      }
      assert(threw).true();
    });
  };

  rejects("missing powerupName", { ...base, powerupName: undefined });
  rejects("missing version", { ...base, version: undefined });
  rejects("missing location", { ...base, location: undefined });
  rejects("missing timestamp", { ...base, timestamp: undefined });
  rejects("missing stepName", { ...base, stepName: undefined });
  rejects("missing output", { ...base, output: undefined });
  rejects("missing stepType", { ...base, stepType: undefined });
  rejects("unknown powerup type", { ...base, type: "once" });
  rejects("unknown step type", { ...base, stepType: "include" });
  rejects("unknown status", { ...base, status: "failed" });
  rejects("unknown output discriminator", { ...base, output: { type: "bogus" } });
  rejects("create output missing path", { ...base, output: { type: "create", action: "create", characterCount: 1 } });
  rejects("create output missing action", { ...base, output: { type: "create", path: "x", characterCount: 1 } });
  rejects("create output missing characterCount", { ...base, output: { type: "create", path: "x", action: "create" } });
  rejects("create output with negative characterCount", { ...base, output: { type: "create", path: "x", action: "create", characterCount: -1 } });
  rejects("create output with non-integer characterCount", { ...base, output: { type: "create", path: "x", action: "create", characterCount: 1.5 } });
  rejects("create output with unknown action", { ...base, output: { type: "create", path: "x", action: "move", characterCount: 1 } });
  rejects("delete output with a characterCount (not in shape)", { ...base, stepType: "delete", output: { type: "delete", path: "x", characterCount: 1 } });
  rejects("install output with non-string dependencies", { ...base, stepType: "install", output: { type: "install", dependencies: [1] } });
  rejects("read output missing variable", { ...base, stepType: "read", output: { type: "read" } });
  rejects("none output with extra fields", { ...base, status: "skipped-already-applied", output: { type: "none", path: "x" } });
  rejects("non-string powerupName (number)", { ...base, powerupName: 1 });
  rejects("extra unknown key on line (strict)", { ...base, variables: {} });
  rejects("the old per-run shape with steps/files and no output", {
    powerupName: "react-setup",
    version: "1.2.0",
    location: "~/.powerups/stores/npm/react-setup/",
    type: "multi-use",
    timestamp: "2025-01-01T00:00:00.000Z",
    steps: [{ name: "create-app", type: "create", status: "applied" }],
    files: [{ path: "src/App.tsx", action: "create" }],
  });
  rejects("the old added-array shape instead of output", {
    ...base,
    added: [{ path: "src/App.tsx", action: "create" }],
    output: undefined,
  });
  rejects("a bare string", "not an object");
  rejects("null", null);
});

test.group("manifest file rejections", () => {
  test.case("rejects a non-array file", assert => {
    let threw = false;
    try {
      manifestSchema.parse(base);
    } catch {
      threw = true;
    }
    assert(threw).true();
  });

  test.case("rejects an array containing an invalid line", assert => {
    let threw = false;
    try {
      manifestSchema.parse([base, { ...base, output: { type: "bogus" } }]);
    } catch {
      threw = true;
    }
    assert(threw).true();
  });
});