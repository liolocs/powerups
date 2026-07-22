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
      steps: [],
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
      steps: [],
    },
  });
  await writeOutput({
    name: "all-components",
    instructions: {
      name: "all-components",
      description: "test description",
      variables: { required: ["theme"] },
      intent: [],
      steps: [
        { type: "include", name: "button", variables: { componentName: "Button", theme: "{{theme}}" } },
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
      steps: [],
    },
  });
  await writeOutput({
    name: "b",
    instructions: {
      name: "b",
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      steps: [
        { type: "include", name: "c", variables: { val: "{{val}}" } },
      ],
    },
  });
  await writeOutput({
    name: "a",
    instructions: {
      name: "a",
      description: "test description",
      variables: { required: ["val"] },
      intent: [],
      steps: [
        { type: "include", name: "b", variables: { val: "{{val}}" } },
      ],
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
      steps: [
        { type: "include", name: "nonexistent", variables: {} },
      ],
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
      steps: [
        { type: "include", name: "b-cycle", variables: {} },
      ],
    },
  });
  await writeOutput({
    name: "b-cycle",
    instructions: {
      name: "b-cycle",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "a-cycle", variables: {} },
      ],
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
      steps: [
        { type: "include", name: "deep-b", variables: {} },
      ],
    },
  });
  await writeOutput({
    name: "deep-b",
    instructions: {
      name: "deep-b",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "deep-c", variables: {} },
      ],
    },
  });
  await writeOutput({
    name: "deep-c",
    instructions: {
      name: "deep-c",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "deep-b", variables: {} },
      ],
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
      steps: [],
    },
  });
  await writeOutput({
    name: "diamond-c",
    instructions: {
      name: "diamond-c",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "diamond-b", variables: {} },
      ],
    },
  });
  await writeOutput({
    name: "diamond-a",
    instructions: {
      name: "diamond-a",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "diamond-b", variables: {} },
        { type: "include", name: "diamond-c", variables: {} },
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
      steps: [],
    },
  });
  await writeOutput({
    name: "parent-missing-map",
    instructions: {
      name: "parent-missing-map",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "child-needs-vars", variables: { componentName: "Button" } },
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
      steps: [],
    },
  });
  await writeOutput({
    name: "ref-parent",
    instructions: {
      name: "ref-parent",
      description: "test description",
      variables: { required: ["theme"] },
      intent: [],
      steps: [
        { type: "include", name: "ref-child", variables: { val: "{{nonexistent}}" } },
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

test.case("should report an issue for a stepOverride key not in suboutput steps", async assert => {
  await reset();
  await writeOutput({
    name: "override-child",
    instructions: {
      name: "override-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "create", name: "real-file", template: "t.njk", outputPath: "out.ts" },
      ],
    },
  });
  await writeOutput({
    name: "override-parent",
    instructions: {
      name: "override-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "override-child",
          variables: {},
          stepOverride: {
            "nonexistent-file": { type: "create", template: "t.njk", outputPath: "src/new.ts" },
          },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/override-parent"),
  });

  assert(issues.some(i => i.includes("stepOverride target not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-file"))).true();
  await testRoot.remove();
});

test.case("should report an issue for a modify stepOverride key not in suboutput steps", async assert => {
  await reset();
  await writeOutput({
    name: "modify-override-child",
    instructions: {
      name: "modify-override-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "modify", name: "real-modify", template: "m.json", outputPath: "out.ts" },
      ],
    },
  });
  await writeOutput({
    name: "modify-override-parent",
    instructions: {
      name: "modify-override-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "modify-override-child",
          variables: {},
          stepOverride: {
            "nonexistent-modify": { type: "modify", template: "m.json", outputPath: "src/new.ts" },
          },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/modify-override-parent"),
  });

  assert(issues.some(i => i.includes("stepOverride target not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-modify"))).true();
  await testRoot.remove();
});

test.case("should report an issue for a delete stepOverride key not in suboutput steps", async assert => {
  await reset();
  await writeOutput({
    name: "delete-override-child",
    instructions: {
      name: "delete-override-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "delete", name: "real-delete", outputPath: "src/old.ts" },
      ],
    },
  });
  await writeOutput({
    name: "delete-override-parent",
    instructions: {
      name: "delete-override-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "delete-override-child",
          variables: {},
          stepOverride: {
            "nonexistent-delete": { type: "delete", outputPath: "src/custom.ts" },
          },
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/delete-override-parent"),
  });

  assert(issues.some(i => i.includes("stepOverride target not found"))).true();
  assert(issues.some(i => i.includes("nonexistent-delete"))).true();
  await testRoot.remove();
});

test.case("should return no issues for a valid delete stepOverride", async assert => {
  await reset();
  await writeOutput({
    name: "valid-delete-child",
    instructions: {
      name: "valid-delete-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "delete", name: "legacy", outputPath: "src/legacy.ts" },
      ],
    },
  });
  await writeOutput({
    name: "valid-delete-parent",
    instructions: {
      name: "valid-delete-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "valid-delete-child",
          variables: {},
          stepOverride: {
            legacy: { type: "delete", outputPath: "src/custom/legacy.ts" },
          },
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
      steps: [],
    },
  });
  await writeOutput({
    name: "dual-parent",
    instructions: {
      name: "dual-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "include", name: "dual-child", variables: { componentName: "Primary" } },
        { type: "include", name: "dual-child", variables: { componentName: "Secondary" } },
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
      steps: [
        { type: "include", name: "broken-child", variables: {} },
      ],
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

test.case("should return no issues for valid excludeSteps", async assert => {
  await reset();
  await writeOutput({
    name: "exclude-valid-child",
    instructions: {
      name: "exclude-valid-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "create", name: "comp", template: "c.njk", outputPath: "src/comp.ts" },
        { type: "create", name: "test", template: "t.njk", outputPath: "src/test.ts" },
      ],
    },
  });
  await writeOutput({
    name: "exclude-valid-parent",
    instructions: {
      name: "exclude-valid-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "exclude-valid-child",
          variables: {},
          excludeSteps: ["test"],
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/exclude-valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});

test.case("should report an issue for an excludeSteps name not in suboutput steps", async assert => {
  await reset();
  await writeOutput({
    name: "exclude-notfound-child",
    instructions: {
      name: "exclude-notfound-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "create", name: "real", template: "r.njk", outputPath: "src/real.ts" },
      ],
    },
  });
  await writeOutput({
    name: "exclude-notfound-parent",
    instructions: {
      name: "exclude-notfound-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "exclude-notfound-child",
          variables: {},
          excludeSteps: ["nonexistent"],
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/exclude-notfound-parent"),
  });

  assert(issues.some(i => i.includes("excludeSteps target not found"))).true();
  assert(issues.some(i => i.includes("nonexistent"))).true();
  await testRoot.remove();
});

test.case("should report a conflict when a step name is in both excludeSteps and stepOverride", async assert => {
  await reset();
  await writeOutput({
    name: "exclude-conflict-child",
    instructions: {
      name: "exclude-conflict-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "create", name: "comp", template: "c.njk", outputPath: "src/comp.ts" },
      ],
    },
  });
  await writeOutput({
    name: "exclude-conflict-parent",
    instructions: {
      name: "exclude-conflict-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "exclude-conflict-child",
          variables: {},
          stepOverride: {
            comp: { type: "create", template: "c.njk", outputPath: "src/overridden.ts" },
          },
          excludeSteps: ["comp"],
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/exclude-conflict-parent"),
  });

  assert(issues.some(i => i.includes("conflict"))).true();
  assert(issues.some(i => i.includes("comp"))).true();
  assert(issues.some(i => i.includes("excludeSteps"))).true();
  assert(issues.some(i => i.includes("stepOverride"))).true();
  await testRoot.remove();
});

test.case("should return no issues for excludeSteps with delete step", async assert => {
  await reset();
  await writeOutput({
    name: "exclude-delete-valid-child",
    instructions: {
      name: "exclude-delete-valid-child",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        { type: "delete", name: "legacy", outputPath: "src/legacy.ts" },
      ],
    },
  });
  await writeOutput({
    name: "exclude-delete-valid-parent",
    instructions: {
      name: "exclude-delete-valid-parent",
      description: "test description",
      variables: { required: [] },
      intent: [],
      steps: [
        {
          type: "include",
          name: "exclude-delete-valid-child",
          variables: {},
          excludeSteps: ["legacy"],
        },
      ],
    },
  });

  const issues = await validateOutputTree({
    rootOutputDir: multiUseFolder,
    currentOutputDir: multiUseFolder.append("/exclude-delete-valid-parent"),
  });

  assert(issues.length).equals(0);
  await testRoot.remove();
});