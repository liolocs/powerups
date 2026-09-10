import test from "#test-utils/test/index";
import { extractStepsArray, replaceStepInIndex, replaceStepsArray } from "#utils/template-conversion/steps-region";

const indexContent = [
  `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";`,
  ``,
  `const instructions: Instructions = {`,
  `  name: "x",`,
  `  type: "single-use",`,
  `  description: "x",`,
  `  variables: { required: [], optional: [] },`,
  `  intent: [],`,
  `  steps: [`,
  `    {`,
  `      "type": "create",`,
  `      "name": "a",`,
  `      "file": "src/create/a.txt",`,
  `      "outputPath": "a.txt"`,
  `    }`,
  `  ],`,
  `};`,
  ``,
  `export default defineInstructions(instructions, import.meta.url);`,
].join("\n");

test.case("extracts the steps array as JSON", async assert => {
  const steps = extractStepsArray({ indexContent });
  assert(steps.length).equals(1);
  assert((steps[0] as { name: string }).name).equals("a");
});

test.case("replaces a step by name and re-serializes the region", async assert => {
  const updated = replaceStepInIndex({
    indexContent,
    stepName: "a",
    newStep: {
      type: "dynamic-create",
      name: "a",
      template: "src/dynamic-create/a.ts",
      outputPath: "a.txt",
    },
  });

  const steps = extractStepsArray({ indexContent: updated });
  assert((steps[0] as { type: string }).type).equals("dynamic-create");
  assert(updated).includes('"template": "src/dynamic-create/a.ts"');
});

test.case("replaceStepsArray round-trips arbitrary step objects", async assert => {
  const updated = replaceStepsArray({
    indexContent,
    steps: [{ type: "delete", name: "d", outputPath: "d.txt" }],
  });
  const steps = extractStepsArray({ indexContent: updated });
  assert((steps[0] as { type: string }).type).equals("delete");
});

test.case("throws steps_region_invalid for content without a steps array", async assert => {
  try {
    extractStepsArray({ indexContent: "export default {};" });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("steps_region_invalid");
  }
});

test.case("throws steps_region_invalid for non-JSON arrays (hand-authored TS expressions)", async assert => {
  const content = indexContent.replace('"file": "src/create/a.txt"', '"file": `src/create/${dynamic}.txt`');
  try {
    extractStepsArray({ indexContent: content });
    assert(false).true();
  } catch (error) {
    // @ts-expect-error error.code is not typed on unknown
    assert(error.code).equals("steps_region_invalid");
  }
});
