import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { validateOutputTree } from "#utils/validate-output";
import { MAIN_FOLDER, ACTIVE_FOLDER, MULTI_USE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const multiUseFolder: FileRef = mainFolder.append(`/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(multiUseFolder);
}

async function writeOutput({
  name,
  instructions,
}: {
  name: string;
  instructions: Record<string, unknown>;
}) {
  const dir = multiUseFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
}

test.case("should return no issues for a valid tree with no includes", async assert => {
  await reset();
  await writeOutput({
    name: "simple",
    instructions: {
      name: "simple",
      description: "test description",
      variables: { required: ["ComponentName"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/simple"),
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
      description: "test description",
      variables: { required: ["componentName", "theme"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "all-components",
    instructions: {
      name: "all-components",
      description: "test description",
      variables: { required: ["theme"] },
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
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/all-components"),
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
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "b",
    instructions: {
      name: "b",
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "c", variables: { val: "{{val}}" } }],
    },
  });
  await writeOutput({
    name: "a",
    instructions: {
      name: "a",
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "b", variables: { val: "{{val}}" } }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/a"),
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
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "nonexistent", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/parent"),
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
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "b-cycle", variables: {} }],
    },
  });
  await writeOutput({
    name: "b-cycle",
    instructions: {
      name: "b-cycle",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "a-cycle", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/a-cycle"),
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
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-b", variables: {} }],
    },
  });
  await writeOutput({
    name: "deep-b",
    instructions: {
      name: "deep-b",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-c", variables: {} }],
    },
  });
  await writeOutput({
    name: "deep-c",
    instructions: {
      name: "deep-c",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "deep-b", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/deep-a"),
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
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "diamond-c",
    instructions: {
      name: "diamond-c",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "diamond-b", variables: {} }],
    },
  });
  await writeOutput({
    name: "diamond-a",
    instructions: {
      name: "diamond-a",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "diamond-b", variables: {} },
        { name: "diamond-c", variables: {} },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/diamond-a"),
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
      description: "test description",
      variables: { required: ["componentName", "theme"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "parent-missing-map",
    instructions: {
      name: "parent-missing-map",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "child-needs-vars", variables: { componentName: "Button" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/parent-missing-map"),
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
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "ref-parent",
    instructions: {
      name: "ref-parent",
      description: "test description",
      variables: { required: ["theme"] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "ref-child", variables: { val: "{{nonexistent}}" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/ref-parent"),
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
      description: "test description",
      variables: { required: [] },
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
      description: "test description",
      variables: { required: [] },
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
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/override-parent"),
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
      description: "test description",
      variables: { required: [] },
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
      description: "test description",
      variables: { required: [] },
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
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/modify-override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-modify"))).true();
  await testRoot.remove();
});

test.case("should report an issue for a delete override file name not in suboutput", async assert => {
  await reset();
  await writeOutput({
    name: "delete-override-child",
    instructions: {
      name: "delete-override-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: {
        create: [],
        modify: [],
        delete: [{ name: "real-delete", outputPath: "src/old.ts" }],
      },
    },
  });
  await writeOutput({
    name: "delete-override-parent",
    instructions: {
      name: "delete-override-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        {
          name: "delete-override-child",
          variables: {},
          outputPathOverride: { delete: { "nonexistent-delete": "src/custom.ts" } },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/delete-override-parent"),
  });

  assert(issues.some(i => i.includes("override file not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-delete"))).true();
  await testRoot.remove();
});

test.case("should return no issues for a valid delete override", async assert => {
  await reset();
  await writeOutput({
    name: "valid-delete-child",
    instructions: {
      name: "valid-delete-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: {
        create: [],
        modify: [],
        delete: [{ name: "legacy", outputPath: "src/legacy.ts" }],
      },
    },
  });
  await writeOutput({
    name: "valid-delete-parent",
    instructions: {
      name: "valid-delete-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        {
          name: "valid-delete-child",
          variables: {},
          outputPathOverride: { delete: { legacy: "src/custom/legacy.ts" } },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/valid-delete-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should validate both independently when the same suboutput is referenced twice", async assert => {
  await reset();
  await writeOutput({
    name: "dual-child",
    instructions: {
      name: "dual-child",
      description: "test description",
      variables: { required: ["componentName"] },
      intent: [],
      output: { create: [], modify: [] },
    },
  });
  await writeOutput({
    name: "dual-parent",
    instructions: {
      name: "dual-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [
        { name: "dual-child", variables: { componentName: "Primary" } },
        { name: "dual-child", variables: { componentName: "Secondary" } },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/dual-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should report an issue and skip recursion for a suboutput with unparseable instructions", async assert => {
  await reset();
  const childDir = multiUseFolder.append("/broken-child");
  await fs.create(childDir);
  await childDir.append("/instructions.json").writeJSON({ name: 123 });
  await writeOutput({
    name: "broken-parent",
    instructions: {
      name: "broken-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "broken-child", variables: {} }],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/broken-parent"),
  });

  assert(issues.length).equals(1);
  assert(issues[0]).includes("broken-child");
  await testRoot.remove();
});