import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validateOutputTree } from "#utils/validate-output";
import { MAIN_FOLDER, OUTPUT_FOLDER, TEMPLATE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const templateFolder: FileRef = mainFolder.append(`/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(templateFolder);
}

async function writeOutput({
  name,
  instructions,
}: {
  name: string;
  instructions: Record<string, unknown>;
}) {
  const dir = templateFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("should return no issues for a valid tree with no includes", async assert => {
  await reset();
  await writeOutput({
    name: "simple",
    instructions: {
      name: "simple",
      variables: ["ComponentName"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/simple"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return no issues for a valid tree with one suboutput", async assert => {
  await reset();
  await writeOutput({
    name: "button",
    instructions: {
      name: "button",
      variables: ["componentName", "theme"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "all-components",
    instructions: {
      name: "all-components",
      variables: ["theme"],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        {
          name: "button",
          variables: { componentName: "Button", theme: "{{theme}}" },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/all-components"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should return no issues for valid nested suboutputs", async assert => {
  await reset();
  await writeOutput({
    name: "c",
    instructions: {
      name: "c",
      variables: ["val"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "b",
    instructions: {
      name: "b",
      variables: ["val"],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "c", variables: { val: "{{val}}" } }],
    },
  });
  await writeOutput({
    name: "a",
    instructions: {
      name: "a",
      variables: ["val"],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "b", variables: { val: "{{val}}" } }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should report an issue for a missing suboutput", async assert => {
  await reset();
  await writeOutput({
    name: "parent",
    instructions: {
      name: "parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "nonexistent", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("suboutput not found: nonexistent");
  await testRoot.remove();
});

test.case("should report an issue with chain for a circular reference", async assert => {
  await reset();
  await writeOutput({
    name: "a-cycle",
    instructions: {
      name: "a-cycle",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "b-cycle", variables: {} }],
    },
  });
  await writeOutput({
    name: "b-cycle",
    instructions: {
      name: "b-cycle",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "a-cycle", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/a-cycle"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("a-cycle → b-cycle → a-cycle"))).true();
  await testRoot.remove();
});

test.case("should report an issue with chain for a deep circular reference", async assert => {
  await reset();
  await writeOutput({
    name: "deep-a",
    instructions: {
      name: "deep-a",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-b", variables: {} }],
    },
  });
  await writeOutput({
    name: "deep-b",
    instructions: {
      name: "deep-b",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-c", variables: {} }],
    },
  });
  await writeOutput({
    name: "deep-c",
    instructions: {
      name: "deep-c",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-b", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/deep-a"),
  });

  assert(issues.some(i => i.includes("circular reference"))).true();
  assert(issues.some(i => i.includes("deep-b → deep-c → deep-b"))).true();
  await testRoot.remove();
});

test.case("should not report a cycle for a diamond shape", async assert => {
  await reset();
  await writeOutput({
    name: "diamond-b",
    instructions: {
      name: "diamond-b",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "diamond-c",
    instructions: {
      name: "diamond-c",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "diamond-b", variables: {} }],
    },
  });
  await writeOutput({
    name: "diamond-a",
    instructions: {
      name: "diamond-a",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "diamond-b", variables: {} },
        { name: "diamond-c", variables: {} },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/diamond-a"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should report an issue for an unmapped variable", async assert => {
  await reset();
  await writeOutput({
    name: "child-needs-vars",
    instructions: {
      name: "child-needs-vars",
      variables: ["componentName", "theme"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "parent-missing-map",
    instructions: {
      name: "parent-missing-map",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "child-needs-vars", variables: { componentName: "Button" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/parent-missing-map"),
  });

  assert(issues.some(i => i.includes("unmapped variable: theme"))).true();
  assert(issues.some(i => i.includes("child-needs-vars"))).true();
  await testRoot.remove();
});

test.case("should report an issue for an invalid parentVar reference", async assert => {
  await reset();
  await writeOutput({
    name: "ref-child",
    instructions: {
      name: "ref-child",
      variables: ["val"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "ref-parent",
    instructions: {
      name: "ref-parent",
      variables: ["theme"],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "ref-child", variables: { val: "{{nonexistent}}" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/ref-parent"),
  });

  assert(issues.some(i => i.includes("invalid reference"))).true();
  assert(issues.some(i => i.includes("nonexistent"))).true();
  await testRoot.remove();
});

test.case("should report an issue for a create override file name not in suboutput", async assert => {
  await reset();
  await writeOutput({
    name: "override-child",
    instructions: {
      name: "override-child",
      variables: [],
      intent: [],
      output: {
        create: [{ name: "real-file", template: "t.njk", outputPath: "out.ts" }],
        modify: [],
      },
    },
  });
  await writeOutput({
    name: "override-parent",
    instructions: {
      name: "override-parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        {
          name: "override-child",
          variables: {},
          outputPathOverride: { create: { "nonexistent-file": "src/new.ts" } },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-file"))).true();
  await testRoot.remove();
});

test.case("should report an issue for a modify override file name not in suboutput", async assert => {
  await reset();
  await writeOutput({
    name: "modify-override-child",
    instructions: {
      name: "modify-override-child",
      variables: [],
      intent: [],
      output: {
        create: [],
        modify: [{ name: "real-modify", template: "m.json", outputPath: "out.ts" }],
      },
    },
  });
  await writeOutput({
    name: "modify-override-parent",
    instructions: {
      name: "modify-override-parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        {
          name: "modify-override-child",
          variables: {},
          outputPathOverride: { modify: { "nonexistent-modify": "src/new.ts" } },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/modify-override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-modify"))).true();
  await testRoot.remove();
});

test.case("should validate both independently when the same suboutput is referenced twice", async assert => {
  await reset();
  await writeOutput({
    name: "dual-child",
    instructions: {
      name: "dual-child",
      variables: ["componentName"],
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "dual-parent",
    instructions: {
      name: "dual-parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "dual-child", variables: { componentName: "Primary" } },
        { name: "dual-child", variables: { componentName: "Secondary" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/dual-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should report an issue and skip recursion for a suboutput with unparseable instructions", async assert => {
  await reset();
  const childDir = templateFolder.append("/broken-child");
  await fs.create(childDir);
  await childDir.append("/instructions.json").writeJSON({ name: 123 });
  await writeOutput({
    name: "broken-parent",
    instructions: {
      name: "broken-parent",
      variables: [],
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "broken-child", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: templateFolder,
    currentOutputDir: templateFolder.append("/broken-parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("broken-child");
  await testRoot.remove();
});