import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { executeSteps, navigateJsonPath } from "#utils/execute-steps";
import type { Step } from "#schemas/instruction";
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

async function writeOutput(name: string, instructions: Record<string, unknown>, templates: Record<string, string> = {}) {
  const dir = multiUseFolder.append(`/${name}`);
  await fs.create(dir);
  await dir.append("/instructions.json").writeJSON(instructions as never);
  for (const [filename, content] of Object.entries(templates)) {
    await dir.append(`/${filename}`).write(content);
  }
}

// ── navigateJsonPath tests ──────────────────────────────────────────

test.case("navigateJsonPath returns top-level value", async assert => {
  assert(navigateJsonPath({ name: "my-package" }, "name")).equals("my-package");
});

test.case("navigateJsonPath returns nested value", async assert => {
  assert(navigateJsonPath({ dependencies: { express: "^4.0.0" } }, "dependencies.express")).equals("^4.0.0");
});

test.case("navigateJsonPath returns deeply nested value", async assert => {
  assert(navigateJsonPath({ a: { b: { c: "deep" } } }, "a.b.c")).equals("deep");
});

test.case("navigateJsonPath throws for non-existent path", async assert => {
  let threw = false;
  try {
    navigateJsonPath({ name: "pkg" }, "nonexistent");
  } catch {
    threw = true;
  }
  assert(threw).true();
});

// ── executeSteps: create step ────────────────────────────────────────

test.case("executeSteps creates a file from a create step (dry-run)", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" },
    ],
  }, { "comp.njk": "<button>{{componentName}}</button>" });

  let output = "";
  const originalPrint = cli.print;
  (cli as { print: (...messages: string[]) => boolean }).print = (s: string) => { output += s; return true; };

  const chars = await executeSteps({
    steps: [{ type: "create", name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" }] as unknown as Step[],
    variables: { componentName: "Button" },
    outputFolder: multiUseFolder.append("/simple"),
    rootDir: testRoot,
    worktreeRoot: undefined,
    outputsFolder: multiUseFolder,
    isDryRun: true,
    isOverwrite: false,
    changedFiles: [],
  });

  (cli as { print: (...messages: string[]) => boolean }).print = originalPrint;
  assert(chars > 0);
  assert(output.includes("Button"));
  await testRoot.remove();
});

test.case("executeSteps creates a file from a create step (real mode)", async assert => {
  await reset();
  await writeOutput("simple", {
    name: "simple",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" },
    ],
  }, { "comp.njk": "<button>{{componentName}}</button>" });

  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);

  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [{ type: "create", name: "comp", template: "comp.njk", outputPath: "src/{{componentName}}.ts" }] as unknown as Step[],
    variables: { componentName: "Button" },
    outputFolder: multiUseFolder.append("/simple"),
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  const written = await fs.ref(changedFiles[0].worktreePath).text();
  assert(written).includes("Button");
  await testRoot.remove();
});

// ── executeSteps: read step ──────────────────────────────────────────

test.case("executeSteps read step (jsonPath mode) mutates variables", async assert => {
  await reset();
  await testRoot.append("/package.json").writeJSON({ name: "@myorg/ui" });

  await writeOutput("read-test", {
    name: "read-test",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
    ],
  });

  const variables: Record<string, string> = { componentName: "Button" };

  await executeSteps({
    steps: [{ type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" }] as unknown as Step[],
    variables,
    outputFolder: multiUseFolder.append("/read-test"),
    rootDir: testRoot,
    worktreeRoot: undefined,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles: [],
  });

  assert(variables.packageName).equals("@myorg/ui");
  await testRoot.remove();
});

test.case("executeSteps read step (dry-run) sets variable to as value", async assert => {
  await reset();
  await writeOutput("read-dry", {
    name: "read-dry",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
    ],
  });

  const variables: Record<string, string> = { componentName: "Button" };

  await executeSteps({
    steps: [{ type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" }] as unknown as Step[],
    variables,
    outputFolder: multiUseFolder.append("/read-dry"),
    rootDir: testRoot,
    worktreeRoot: undefined,
    outputsFolder: multiUseFolder,
    isDryRun: true,
    isOverwrite: false,
    changedFiles: [],
  });

  assert(variables.packageName).equals("packageName");
  await testRoot.remove();
});

test.case("executeSteps read step (raw mode) stores entire file content", async assert => {
  await reset();
  await testRoot.append("/LICENSE").write("MIT License Text");

  await writeOutput("read-raw", {
    name: "read-raw",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "read", name: "read-license", path: "LICENSE", as: "licenseText" },
    ],
  });

  const variables: Record<string, string> = {};

  await executeSteps({
    steps: [{ type: "read", name: "read-license", path: "LICENSE", as: "licenseText" }] as unknown as Step[],
    variables,
    outputFolder: multiUseFolder.append("/read-raw"),
    rootDir: testRoot,
    worktreeRoot: undefined,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles: [],
  });

  assert(variables.licenseText).equals("MIT License Text\n");
  await testRoot.remove();
});

test.case("executeSteps read step throws for missing file", async assert => {
  await reset();
  await writeOutput("read-missing", {
    name: "read-missing",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "read", name: "read-missing", path: "nonexistent.json", as: "val", jsonPath: "x" },
    ],
  });

  let threw = false;
  try {
    await executeSteps({
      steps: [{ type: "read", name: "read-missing", path: "nonexistent.json", as: "val", jsonPath: "x" }] as unknown as Step[],
      variables: {},
      outputFolder: multiUseFolder.append("/read-missing"),
      rootDir: testRoot,
      worktreeRoot: undefined,
      outputsFolder: multiUseFolder,
      isDryRun: false,
      isOverwrite: false,
      changedFiles: [],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
  await testRoot.remove();
});

test.case("executeSteps read step with {{token}} in path resolves from variables", async assert => {
  await reset();
  await fs.create(testRoot.append("/packages"));
  await fs.create(testRoot.append("/packages/myorg"));
  await testRoot.append("/packages/myorg/package.json").writeJSON({ name: "@myorg/ui" });

  await writeOutput("read-path-token", {
    name: "read-path-token",
    description: "test",
    variables: { required: ["orgName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "packages/{{orgName}}/package.json", as: "pkgName", jsonPath: "name" },
    ],
  });

  const variables: Record<string, string> = { orgName: "myorg" };

  await executeSteps({
    steps: [{ type: "read", name: "read-pkg", path: "packages/{{orgName}}/package.json", as: "pkgName", jsonPath: "name" }] as unknown as Step[],
    variables,
    outputFolder: multiUseFolder.append("/read-path-token"),
    rootDir: testRoot,
    worktreeRoot: undefined,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles: [],
  });

  assert(variables.pkgName).equals("@myorg/ui");
  await testRoot.remove();
});

// ── executeSteps: include step ───────────────────────────────────────

test.case("executeSteps include step recurses into child", async assert => {
  await reset();
  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);

  await writeOutput("child", {
    name: "child",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" },
    ],
  }, { "c.njk": "<button>{{componentName}}</button>" });

  await writeOutput("parent", {
    name: "parent",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "include", name: "child", variables: { componentName: "Button" } },
    ],
  });

  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [{ type: "include", name: "child", variables: { componentName: "Button" } }] as unknown as Step[],
    variables: {},
    outputFolder: multiUseFolder.append("/parent"),
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  assert(changedFiles[0].projectPath).equals("src/Button.tsx");
  const written = await fs.ref(changedFiles[0].worktreePath).text();
  assert(written).includes("Button");
  await testRoot.remove();
});

test.case("executeSteps include step with excludeSteps skips child steps", async assert => {
  await reset();
  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);

  await writeOutput("exclude-child", {
    name: "exclude-child",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "foo", template: "foo.njk", outputPath: "src/{{componentName}}.ts" },
      { type: "create", name: "bar", template: "bar.njk", outputPath: "src/{{componentName}}.bar.ts" },
    ],
  }, { "foo.njk": "foo", "bar.njk": "bar" });

  await writeOutput("exclude-parent", {
    name: "exclude-parent",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      { type: "include", name: "exclude-child", variables: { componentName: "Button" }, excludeSteps: ["bar"] },
    ],
  });

  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [{ type: "include", name: "exclude-child", variables: { componentName: "Button" }, excludeSteps: ["bar"] }] as unknown as Step[],
    variables: {},
    outputFolder: multiUseFolder.append("/exclude-parent"),
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  assert(changedFiles[0].projectPath).equals("src/Button.ts");
  await testRoot.remove();
});

test.case("executeSteps include step with stepOverride replaces child step", async assert => {
  await reset();
  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);

  await writeOutput("override-child", {
    name: "override-child",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "create", name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" },
    ],
  }, { "c.njk": "original" });

  await writeOutput("override-parent", {
    name: "override-parent",
    description: "test",
    variables: { required: [] },
    intent: [],
    steps: [
      {
        type: "include",
        name: "override-child",
        variables: { componentName: "Button" },
        stepOverride: {
          comp: { type: "create", template: "c.njk", outputPath: "src/ui/{{componentName}}.tsx" },
        },
      },
    ],
  });

  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [{
      type: "include",
      name: "override-child",
      variables: { componentName: "Button" },
      stepOverride: {
        comp: { type: "create", template: "c.njk", outputPath: "src/ui/{{componentName}}.tsx" },
      },
    }] as unknown as Step[],
    variables: {},
    outputFolder: multiUseFolder.append("/override-parent"),
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  assert(changedFiles[0].projectPath).equals("src/ui/Button.tsx");
  await testRoot.remove();
});

// ── executeSteps: delete step ────────────────────────────────────────

test.case("executeSteps delete step removes file (real mode)", async assert => {
  await reset();
  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);
  await fs.create(worktreeDir.append("/src"));
  await worktreeDir.append("/src/old.ts").write("old content");

  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [{ type: "delete", name: "old", outputPath: "src/old.ts" }] as unknown as Step[],
    variables: {},
    outputFolder: multiUseFolder,
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  assert(changedFiles[0].deleted).true();
  assert(await fs.exists(worktreeDir.append("/src/old.ts"))).false();
  await testRoot.remove();
});

// ── executeSteps: variable mutation flows to subsequent steps ────────

test.case("executeSteps read step value flows to subsequent create step", async assert => {
  await reset();
  const worktreeDir = testRoot.append("/worktree-test");
  await fs.create(worktreeDir);
  await testRoot.append("/package.json").writeJSON({ name: "@myorg/ui" });

  await writeOutput("flow-test", {
    name: "flow-test",
    description: "test",
    variables: { required: ["componentName"] },
    intent: [],
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
      { type: "create", name: "comp", template: "comp.njk", outputPath: "packages/{{packageName}}/src/{{componentName}}.ts" },
    ],
  }, { "comp.njk": "export const {{componentName}} = 1;" });

  const variables: Record<string, string> = { componentName: "Button" };
  const changedFiles: { worktreePath: string; projectPath: string; deleted?: boolean }[] = [];

  await executeSteps({
    steps: [
      { type: "read", name: "read-pkg", path: "package.json", as: "packageName", jsonPath: "name" },
      { type: "create", name: "comp", template: "comp.njk", outputPath: "packages/{{packageName}}/src/{{componentName}}.ts" },
    ] as unknown as Step[],
    variables,
    outputFolder: multiUseFolder.append("/flow-test"),
    rootDir: testRoot,
    worktreeRoot: worktreeDir,
    outputsFolder: multiUseFolder,
    isDryRun: false,
    isOverwrite: false,
    changedFiles,
  });

  assert(changedFiles.length).equals(1);
  assert(changedFiles[0].projectPath).equals("packages/@myorg/ui/src/Button.ts");
  await testRoot.remove();
});