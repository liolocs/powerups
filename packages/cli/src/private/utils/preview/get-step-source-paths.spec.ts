import test from "#test-utils/test/index";
import getStepSourcePaths from "#utils/preview/get-step-source-paths";
import type { Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: "probe",
  type: "multi-use",
  description: "x",
  variables: { required: [], optional: [] },
  intent: [],
  steps: [
    { type: "create", name: "a", file: "src/create/a.txt", outputPath: "a.txt" },
    { type: "dynamic-create", name: "b", template: "src/dynamic-create/b.ts", outputPath: "b.txt" },
    { type: "modify", name: "c", file: "src/modify/c.json.json", outputPath: "c.json" },
    { type: "dynamic-modify", name: "d", template: "templates/d.json.njk", outputPath: "d.json" },
    { type: "read", name: "e", path: "package.json", as: "pkg" },
    { type: "delete", name: "f", outputPath: "f.txt" },
  ],
};

test.case("collects file/template/path references from instruction steps, deduplicated", async assert => {
  assert(getStepSourcePaths({ instructions })).equals([
    "src/create/a.txt",
    "src/dynamic-create/b.ts",
    "src/modify/c.json.json",
    "templates/d.json.njk",
    "package.json",
  ]);
});