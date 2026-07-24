import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import use from "#commands/use/index";
import create from "#commands/create/index";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { UseErrorCode } from "#errors/useErrors";
import io from "@rcompat/io";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { readMetrics } from "#utils/metrics";
import { randomUUID } from "node:crypto";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CONFIG_FILE,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const tempGlobalRoot = path.join(tmpdir(), `powerups-test-${randomUUID()}`);
const tempGlobalRootRef = fs.ref(tempGlobalRoot);
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const internalFolder: FileRef = mainFolder.append(`/${INTERNAL_FOLDER}`);
const multiUseFolder: FileRef = internalFolder.append(`/test-pkg/${SRC_FOLDER}/${ACTIVE_FOLDER}/${MULTI_USE_FOLDER}`);

const createCmd = create;

async function gitInit(dir: FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
  await dir.append("/README.md").write("init");
  await io.run("git add -A", { cwd: dir.path });
  await io.run("git commit -m init", { cwd: dir.path });
}

async function gitCommit(dir: FileRef, message: string): Promise<void> {
  await io.run("git add -A", { cwd: dir.path });
  try {
    await io.run(`git commit -m "${message}"`, { cwd: dir.path });
  } catch {
    // Nothing to commit — that's fine
  }
}

/**
 * Create a powerup with the given steps and optional packageDependencies.
 * Uses createCmd.run to scaffold the folder, then overwrites instructions.json
 * with the provided steps format.
 */
async function createPowerup(
  name: string,
  steps: unknown[],
  opts?: { required?: string[]; optional?: string[]; packageDependencies?: unknown },
) {
  const required = opts?.required ?? [];
  const optional = opts?.optional;
  const packageDependencies = opts?.packageDependencies;
  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--pack", value: "test-pkg" },
      { flag: "--type", value: "multi-use" },
      { flag: "--name", value: name },
      { flag: "--description", value: "test description" },
    ],
    context: { root: testRoot, globalRoot: tempGlobalRoot },
  });
  await multiUseFolder.append(`/${name}/instructions.json`).writeJSON({
    name,
    description: "test description",
    variables: { required, ...(optional ? { optional } : {}) },
    intent: [],
    ...(packageDependencies ? { packageDependencies } : {}),
    steps,
  } as never);
}

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await tempGlobalRootRef.remove();
  await tempGlobalRootRef.create();
  await fs.create(internalFolder);
  // Create test package
  const pkgDir = internalFolder.append("/test-pkg");
  const srcActive = pkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
  await fs.create(srcActive.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(srcActive.append(`/${SINGLE_USE_FOLDER}`));
  await pkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
    name: "test-pkg",
    version: "1.0.0",
    description: "test",
    keywords: [KEYWORD_PACKAGE],
    powerups: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
  });
  // Create config with test-pkg listed
  await mainFolder.append(`/${CONFIG_FILE}`).writeJSON({
    packages: ["test-pkg"],
  });
  await gitInit(testRoot);
}

test.case("apply writes rendered .njk template files to outputPath",
  async assert => {
    await reset();

    await createPowerup("ui-component", [
      { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
    ], { required: ["ComponentName"] });

    const tmplPath = multiUseFolder.append("/ui-component/button.njk");
    await tmplPath.write("<button>{{componentName}}</button>");

    await use.run({
      subcommands: ["ui-component"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const outPath = testRoot.append("/.test-output/Button.svelte");
    assert(await fs.exists(outPath)).true();
    assert((await outPath.text()).trimEnd()).equals("<button>Button</button>");

    await testRoot.remove();
  });

test.case("apply writes rendered .ts template files to outputPath",
  async assert => {
    await reset();

    await createPowerup("ts-output", [
      { type: "create", name: "component.ts", template: "component.ts", outputPath: ".test-output/{{ComponentName}}.ts" },
    ], { required: ["ComponentName"] });

    const tmplPath = multiUseFolder.append("/ts-output/component.ts");
    await tmplPath.write(
      "export default function({ componentName }: Record<string, string>) {\n" +
      "  return `export const ${componentName} = '${componentName}';`;\n" +
      "}\n",
    );

    await use.run({
      subcommands: ["ts-output"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const outPath = testRoot.append("/.test-output/Button.ts");
    assert(await fs.exists(outPath)).true();
    assert((await outPath.text()).trimEnd()).equals("export const Button = 'Button';");

    await testRoot.remove();
  });

test.case("apply with --overwrite overwrites existing destination files", async assert => {
  await reset();

  // Create the target file first and commit to git so it appears in worktree
  await fs.create(testRoot.append("/.test-output"));
  await testRoot.append("/.test-output/Existing.ts").write("old content");
  await gitCommit(testRoot, "add existing file");

  await createPowerup("overwrite-test", [
    { type: "create", name: "f", template: "f.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
  ], { required: ["ComponentName"] });
  await multiUseFolder.append("/overwrite-test/f.njk").write("new content {{componentName}}");

  await use.run({
    subcommands: ["overwrite-test"],
    flags: [
      { flag: "--component-name", value: "Existing" },
      { flag: "--overwrite", value: "true" },
    ],
    context: { root: testRoot, globalRoot: tempGlobalRoot },
  });

  const outPath = testRoot.append("/.test-output/Existing.ts");
  assert((await outPath.text()).trimEnd()).equals("new content Existing");

  await testRoot.remove();
});

test.group("apply errors", () => {
  test.case(`should fail with main_folder_not_found without ${MAIN_FOLDER}} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await gitInit(testRoot);

    let threw;
    try {
      await use.run({
        subcommands: ["anything"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(UseErrorCode.main_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with missing_name when no positional arg given",
    async assert => {
      await reset();

      let threw = false;
      try {
        await use.run({
          subcommands: [],
          flags: [],
          context: { root: testRoot, globalRoot: tempGlobalRoot },
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code).equals("missing_name");
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should fail with not_found for a missing template name", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--pack", value: "test-pkg" }, { flag: "--type", value: "multi-use" }, { flag: "--name", value: "real" },
        { flag: "--description", value: "test description" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    try {
      await use.run({
        subcommands: ["nonexistent"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    } catch (e) {
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code)
        .equals(UseErrorCode.not_found);
    }

    await testRoot.remove();
  });

  test.case("should fail with missing_variables when a required variable is omitted",
    async assert => {
      await reset();

      await createPowerup("needs-vars", [
        { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
      ], { required: ["ComponentName", "theme"] });

      const tmplPath = multiUseFolder.append("/needs-vars/button.njk");
      await tmplPath.write("<button>{{componentName}} {{theme}}</button>");

      let threw = false;
      try {
        await use.run({
          subcommands: ["needs-vars"],
          flags: [{ flag: "--component-name", value: "Button" }],
          context: { root: testRoot, globalRoot: tempGlobalRoot },
          // Missing --theme
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code)
          .equals(UseErrorCode.missing_variables);
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should fail with invalid_composition when a template file is missing",
    async assert => {
      await reset();

      await createPowerup("missing-tmpl", [
        { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
      ], { required: ["ComponentName"] });

      // Remove the template file
      const tmplPath = multiUseFolder.append("/missing-tmpl/button.njk");
      await tmplPath.remove();

      let threw = false;
      try {
        await use.run({
          subcommands: ["missing-tmpl"],
          flags: [{ flag: "--component-name", value: "Button" }],
          context: { root: testRoot, globalRoot: tempGlobalRoot },
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code)
          .equals(UseErrorCode.invalid_composition);
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should warn and skip when the modify target file doesn't exist", async assert => {
    await reset();

    await createPowerup("no-target", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/nonexistent.ts" },
    ]);

    await multiUseFolder.append("/no-target/wire.json")
      .write('[{"where":"top","content":"hello"}]');

    const output = await captureStdout(() => use.run({
      subcommands: ["no-target"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("Warning: skipped modification");
    assert(output).includes("Target file for modification not found");

    await testRoot.remove();
  });

  test.case("should warn and skip when the anchor doesn't exist in the target", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target file");

    await createPowerup("anchor-missing", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
    ]);
    await gitCommit(testRoot, "add template");

    await multiUseFolder.append("/anchor-missing/wire.json")
      .write('[{"where":"NONEXISTENT_ANCHOR","content":"hello"}]');
    await gitCommit(testRoot, "add modify template");

    const output = await captureStdout(() => use.run({
      subcommands: ["anchor-missing"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("Warning: skipped modification");
    assert(output).includes("Anchor \"NONEXISTENT_ANCHOR\" not found");

    await testRoot.remove();
  });

  test.case("should warn and skip when the anchor appears multiple times", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target file");

    await createPowerup("anchor-ambiguous", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
    ]);
    await gitCommit(testRoot, "add template");

    // Target file contains the anchor string twice
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;\nexport const y = 2;");
    await gitCommit(testRoot, "update target file");

    await multiUseFolder.append("/anchor-ambiguous/wire.json")
      .write('[{"where":"export","content":"// replaced"}]');
    await gitCommit(testRoot, "add modify template");

    const output = await captureStdout(() => use.run({
      subcommands: ["anchor-ambiguous"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("Warning: skipped modification");
    assert(output).includes("Anchor \"export\" appears multiple times");

    await testRoot.remove();
  });

  test.case("should fail with destination_file_exists when target exists without --overwrite", async assert => {
    await reset();

    // Create the target file first and commit to git so it appears in worktree
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/Existing.ts").write("old content");
    await gitCommit(testRoot, "add existing file");

    await createPowerup("no-overwrite-test", [
      { type: "create", name: "f", template: "f.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
    ], { required: ["ComponentName"] });
    await multiUseFolder.append("/no-overwrite-test/f.njk").write("new content");

    let threw = false;
    try {
      await use.run({
        subcommands: ["no-overwrite-test"],
        flags: [{ flag: "--component-name", value: "Existing" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("destination_file_exists");
    }
    assert(threw).true();

    // File should NOT be changed (rollback happened)
    assert((await testRoot.append("/.test-output/Existing.ts").text()).trim()).equals("old content");

    await testRoot.remove();
  });

  test.case("should fail with git_repo_required when not in a git repo", async assert => {
    // Use a temp dir outside the project's git repo
    const noGitRoot = fs.ref(path.join(tmpdir(), `powerups-test-nogit-${randomBytes(4).toString("hex")}`));
    await fs.create(noGitRoot);
    await fs.create(noGitRoot.append(`/${MAIN_FOLDER}`));
    // Create test-pkg package in noGitRoot
    const noGitPkgDir = noGitRoot.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/test-pkg`);
    const noGitSrcActive = noGitPkgDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    await fs.create(noGitSrcActive.append(`/${MULTI_USE_FOLDER}`));
    await fs.create(noGitSrcActive.append(`/${SINGLE_USE_FOLDER}`));
    await noGitPkgDir.append(`/${PACKAGE_FILE}`).writeJSON({
      name: "test-pkg",
      version: "1.0.0",
      description: "test",
      keywords: [KEYWORD_PACKAGE],
      powerups: { active: { [MULTI_USE_FOLDER]: {}, [SINGLE_USE_FOLDER]: {} } },
    });
    await noGitRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`).writeJSON({
      packages: ["test-pkg"],
    });

    const noGitTemplateFolder = noGitSrcActive.append(`/${MULTI_USE_FOLDER}`);

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--pack", value: "test-pkg" },
        { flag: "--type", value: "multi-use" },
        { flag: "--name", value: "no-git" },
        { flag: "--description", value: "test description" },
      ],
      context: { root: noGitRoot, globalRoot: tempGlobalRoot },
    });
    await noGitTemplateFolder.append("/no-git/instructions.json").writeJSON({
      name: "no-git",
      description: "test description",
      variables: { required: ["ComponentName"] },
      intent: [],
      steps: [
        { type: "create", name: "f", template: "f.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
      ],
    } as never);
    await noGitTemplateFolder.append("/no-git/f.njk").write("hello {{componentName}}");

    let threw;
    try {
      await use.run({
        subcommands: ["no-git"],
        flags: [{ flag: "--component-name", value: "Button" }],
        context: { root: noGitRoot, globalRoot: tempGlobalRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(UseErrorCode.git_repo_required);

    await noGitRoot.remove();
  });
});

test.group("apply dry-run", () => {
  test.case("should print to stdout without writing files",
    async assert => {
      await reset();

      await createPowerup("dry-run-test", [
        { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
      ], { required: ["ComponentName"] });

      const tmplPath = multiUseFolder.append("/dry-run-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      const output = await captureStdout(() => use.run({
        subcommands: ["dry-run-test"],
        flags: [
          { flag: "--dry-run", value: "true" },
          { flag: "--component-name", value: "Button" },
        ],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      }));

      assert(output).includes("=== .test-output/Button.svelte ===");
      assert(output).includes("<button>Button</button>");

      // Verify no file was written
      const outPath = testRoot.append("/.test-output/Button.svelte");
      assert(await fs.exists(outPath)).false();

      await testRoot.remove();
    });

  test.case("should print modification preview for modify entries", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("line1\n");

    await createPowerup("dry-modify", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
    ]);

    await multiUseFolder.append("/dry-modify/wire.json")
      .write('[{"where":"top","content":"// header"}]');

    const output = await captureStdout(() => use.run({
      subcommands: ["dry-modify"],
      flags: [{ flag: "--dry-run", value: "true" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("=== .test-output/index.ts (modify) ===");
    assert(output).includes("// header");

    // File should NOT be changed
    assert((await testRoot.append("/.test-output/index.ts").text()).trim()).equals("line1");

    await testRoot.remove();
  });
});

test.group("apply composite output", () => {
  test.case("should write files from parent and suboutputs",
    async assert => {
      await reset();

      // Create child template (button component)
      await createPowerup("shadcn-button", [
        { type: "create", name: "component", template: "component.njk", outputPath: ".test-output/{{componentName}}.tsx" },
      ]);
      // Override with required variables
      await multiUseFolder.append("/shadcn-button/instructions.json").writeJSON({
        name: "shadcn-button",
        description: "test description",
        variables: { required: ["componentName", "theme"] },
        intent: [],
        steps: [
          { type: "create", name: "component", template: "component.njk", outputPath: ".test-output/{{componentName}}.tsx" },
        ],
      } as never);
      await multiUseFolder.append("/shadcn-button/component.njk")
        .write("export const {{componentName}} = '{{theme}}';");

      // Create parent template (all components) with includes
      await createPowerup("shadcn-all", [
        { type: "create", name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts" },
        { type: "include", name: "shadcn-button", variables: { componentName: "Button", theme: "{{theme}}" } },
        { type: "include", name: "shadcn-button", variables: { componentName: "Input", theme: "{{theme}}" } },
      ]);
      // Override with required variables
      await multiUseFolder.append("/shadcn-all/instructions.json").writeJSON({
        name: "shadcn-all",
        description: "test description",
        variables: { required: ["theme"] },
        intent: [],
        steps: [
          { type: "create", name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts" },
          { type: "include", name: "shadcn-button", variables: { componentName: "Button", theme: "{{theme}}" } },
          { type: "include", name: "shadcn-button", variables: { componentName: "Input", theme: "{{theme}}" } },
        ],
      } as never);
      await multiUseFolder.append("/shadcn-all/barrel.njk")
        .write("export { Button, Input } from './';");

      await use.run({
        subcommands: ["shadcn-all"],
        flags: [{ flag: "--theme", value: "dark" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      // Parent's barrel file
      const barrelPath = testRoot.append("/.test-output/index.ts");
      assert(await fs.exists(barrelPath)).true();
      assert((await barrelPath.text()).trimEnd())
        .equals("export { Button, Input } from './';");

      // Suboutput files (Button and Input)
      const buttonPath = testRoot.append("/.test-output/Button.tsx");
      assert(await fs.exists(buttonPath)).true();
      assert((await buttonPath.text()).trimEnd())
        .equals("export const Button = 'dark';");

      const inputPath = testRoot.append("/.test-output/Input.tsx");
      assert(await fs.exists(inputPath)).true();
      assert((await inputPath.text()).trimEnd())
        .equals("export const Input = 'dark';");

      await testRoot.remove();
    });

  test.case("should print all outputs without writing with --dry-run",
    async assert => {
      await reset();

      await createPowerup("dry-child", [
        { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.ts" },
      ]);
      // Override with required variables
      await multiUseFolder.append("/dry-child/instructions.json").writeJSON({
        name: "dry-child",
        description: "test description",
        variables: { required: ["componentName"] },
        intent: [],
        steps: [
          { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.ts" },
        ],
      } as never);
      await multiUseFolder.append("/dry-child/comp.njk")
        .write("const {{componentName}} = 1;");

      await createPowerup("dry-parent", [
        { type: "create", name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts" },
        { type: "include", name: "dry-child", variables: { componentName: "Button" } },
      ]);
      await multiUseFolder.append("/dry-parent/barrel.njk").write("barrel");

      const output = await captureStdout(() => use.run({
        subcommands: ["dry-parent"],
        flags: [{ flag: "--dry-run", value: "true" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      }));

      // Parent output
      assert(output).includes("=== .test-output/index.ts ===");
      assert(output).includes("barrel");
      // Suboutput output
      assert(output).includes("=== .test-output/Button.ts ===");
      assert(output).includes("const Button = 1;");

      // Verify no files were written
      assert(await fs.exists(testRoot.append("/.test-output/index.ts"))).false();
      assert(await fs.exists(testRoot.append("/.test-output/Button.ts"))).false();

      await testRoot.remove();
    });

  test.case("should fail with invalid_composition for a missing suboutput",
    async assert => {
      await reset();

      await createPowerup("bad-parent", [
        { type: "include", name: "nonexistent", variables: {} },
      ]);

      let threw = false;
      try {
        await use.run({
          subcommands: ["bad-parent"],
          flags: [],
          context: { root: testRoot, globalRoot: tempGlobalRoot },
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code)
          .equals(UseErrorCode.invalid_composition);
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should write to overridden location with output path override",
    async assert => {
      await reset();

      await createPowerup("override-child", [
        { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/original/{{componentName}}.tsx" },
      ]);
      // Override with required variables
      await multiUseFolder.append("/override-child/instructions.json").writeJSON({
        name: "override-child",
        description: "test description",
        variables: { required: ["componentName"] },
        intent: [],
        steps: [
          { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/original/{{componentName}}.tsx" },
        ],
      } as never);
      await multiUseFolder.append("/override-child/comp.njk")
        .write("const {{componentName}} = 1;");

      await createPowerup("override-parent", [
        {
          type: "include",
          name: "override-child",
          variables: { componentName: "Button" },
          stepOverride: {
            comp: { type: "create", template: "comp.njk", outputPath: ".test-output/overridden/{{componentName}}.tsx" },
          },
        },
      ]);

      await use.run({
        subcommands: ["override-parent"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      // File written to overridden path, not original
      const overriddenPath = testRoot.append("/.test-output/overridden/Button.tsx");
      assert(await fs.exists(overriddenPath)).true();

      // Original path should NOT exist
      const originalPath = testRoot.append("/.test-output/original/Button.tsx");
      assert(await fs.exists(originalPath)).false();

      await testRoot.remove();
    });

  test.case("should write both sets of files when same suboutput is used twice",
    async assert => {
      await reset();

      await createPowerup("dual-child", [
        { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.tsx" },
      ]);
      // Override with required variables
      await multiUseFolder.append("/dual-child/instructions.json").writeJSON({
        name: "dual-child",
        description: "test description",
        variables: { required: ["componentName"] },
        intent: [],
        steps: [
          { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.tsx" },
        ],
      } as never);
      await multiUseFolder.append("/dual-child/comp.njk")
        .write("export const {{componentName}} = 1;");

      await createPowerup("dual-parent", [
        { type: "include", name: "dual-child", variables: { componentName: "Primary" } },
        { type: "include", name: "dual-child", variables: { componentName: "Secondary" } },
      ]);

      await use.run({
        subcommands: ["dual-parent"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      const primaryPath = testRoot.append("/.test-output/Primary.tsx");
      const secondaryPath = testRoot.append("/.test-output/Secondary.tsx");
      assert(await fs.exists(primaryPath)).true();
      assert(await fs.exists(secondaryPath)).true();
      assert((await primaryPath.text()).trimEnd())
        .equals("export const Primary = 1;");
      assert((await secondaryPath.text()).trimEnd())
        .equals("export const Secondary = 1;");

      await testRoot.remove();
    });

  test.case("should skip excluded files when using a powerup with includes",
    async assert => {
      await reset();

      await createPowerup("exclude-child", [
        { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.tsx" },
        { type: "create", name: "test", template: "test.njk", outputPath: ".test-output/{{componentName}}.spec.ts" },
      ]);
      // Override with required variables
      await multiUseFolder.append("/exclude-child/instructions.json").writeJSON({
        name: "exclude-child",
        description: "test description",
        variables: { required: ["componentName"] },
        intent: [],
        steps: [
          { type: "create", name: "comp", template: "comp.njk", outputPath: ".test-output/{{componentName}}.tsx" },
          { type: "create", name: "test", template: "test.njk", outputPath: ".test-output/{{componentName}}.spec.ts" },
        ],
      } as never);
      await multiUseFolder.append("/exclude-child/comp.njk")
        .write("const {{componentName}} = 1;");
      await multiUseFolder.append("/exclude-child/test.njk")
        .write("// test for {{componentName}}");

      await createPowerup("exclude-parent", [
        {
          type: "include",
          name: "exclude-child",
          variables: { componentName: "Button" },
          excludeSteps: ["test"],
        },
      ]);

      await use.run({
        subcommands: ["exclude-parent"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      // The non-excluded file should exist
      const compPath = testRoot.append("/.test-output/Button.tsx");
      assert(await fs.exists(compPath)).true();

      // The excluded file should NOT exist
      const testPath = testRoot.append("/.test-output/Button.spec.ts");
      assert(await fs.exists(testPath)).false();

      await testRoot.remove();
    });
});

test.group("apply modify", () => {
  test.case("should modify an existing file", async assert => {
    await reset();

    // Create the target file and commit to git so it appears in worktree
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("line1\nline2\nline3\n");
    await gitCommit(testRoot, "add target file");

    await createPowerup("modify-test", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
    ]);

    // Write the modify template
    await multiUseFolder.append("/modify-test/wire.json")
      .write('[{"where":"top","content":"// header\\n"},{"where":{"after":"line1"},"content":"inserted"}]');

    await use.run({
      subcommands: ["modify-test"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const outPath = testRoot.append("/.test-output/index.ts");
    assert((await outPath.text()).trim()).equals("// header\nline1inserted\nline2\nline3");

    await testRoot.remove();
  });

  test.case("should render variables in .njk modify template then modify", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;\n");
    await gitCommit(testRoot, "add target file");

    await createPowerup("njk-modify", [
      { type: "modify", name: "wire", template: "wire.njk", outputPath: ".test-output/index.ts" },
    ]);
    // Override with required variables
    await multiUseFolder.append("/njk-modify/instructions.json").writeJSON({
      name: "njk-modify",
      description: "test description",
      variables: { required: ["name"] },
      intent: [],
      steps: [
        { type: "modify", name: "wire", template: "wire.njk", outputPath: ".test-output/index.ts" },
      ],
    } as never);

    await multiUseFolder.append("/njk-modify/wire.njk")
      .write('[{"where":"top","content":"import { {{name}} } from \\"./{{name}}\\";\\n"}]');

    await use.run({
      subcommands: ["njk-modify"],
      flags: [{ flag: "--type", value: "multi-use" }, { flag: "--name", value: "User" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const outPath = testRoot.append("/.test-output/index.ts");

    assert((await outPath.text()).trim())
      .equals('import { User } from "./User";\nexport const x = 1;');

    await testRoot.remove();
  });
});

test.group("apply metrics", () => {
  test.case("should log metrics on a successful run",
    async assert => {
      await reset();

      await createPowerup("metrics-test", [
        { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
      ], { required: ["ComponentName"] });

      const tmplPath = multiUseFolder.append("/metrics-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      await use.run({
        subcommands: ["metrics-test"],
        flags: [{ flag: "--component-name", value: "Button" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      const entries = await readMetrics({ cwd: testRoot.path, globalRoot: tempGlobalRoot });

      assert(entries.length).equals(1);
      assert(entries[0].output).equals("metrics-test");
      assert(entries[0].characters).equals("<button>Button</button>\n".length);

      await testRoot.remove();
    });

  test.case("should not log metrics on dry-run", async assert => {
    await reset();

    await createPowerup("dry-metrics-test", [
      { type: "create", name: "button.svelte", template: "button.njk", outputPath: ".test-output/{{ComponentName}}.svelte" },
    ], { required: ["ComponentName"] });

      const tmplPath = multiUseFolder.append("/dry-metrics-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      await use.run({
        subcommands: ["dry-metrics-test"],
        flags: [
          { flag: "--dry-run", value: "true" },
          { flag: "--component-name", value: "Button" },
        ],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });

      const entries = await readMetrics({ cwd: testRoot.path, globalRoot: tempGlobalRoot });

      assert(entries.length).equals(0);

      await testRoot.remove();
    });
});

test.group("apply packageDependencies", () => {
  test.case("dry-run should print deps without installing", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
    }));
    await testRoot.append("/pnpm-lock.yaml").write("");

    await createPowerup("dep-feature", [], { packageDependencies: [{ dependencies: ["fake-pkg@^1.0.0"] }] });

    const output = await captureStdout(async () => {
      await use.run({
        subcommands: ["dep-feature"],
        flags: [{ flag: "--dry-run", value: "true" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    });

    assert(output.includes("fake-pkg@^1.0.0")).true();
    assert(output.includes("Would run")).true();

    await testRoot.remove();
  });

  test.case("dry-run should print nothing when no packageDependencies", async assert => {
    await reset();

    await createPowerup("no-dep-feature", []);

    const output = await captureStdout(async () => {
      await use.run({
        subcommands: ["no-dep-feature"],
        flags: [{ flag: "--dry-run", value: "true" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    });

    assert(output.includes("Would run")).false();
    assert(output.includes("Dependencies")).false();

    await testRoot.remove();
  });

  test.case("real run should write deps to package.json", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
    }));

    await createPowerup("real-dep", [], { packageDependencies: [{ dependencies: ["fake-pkg@^1.0.0"] }] });

    await use.run({
      subcommands: ["real-dep"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const pkg = JSON.parse(await testRoot.append("/package.json").text());

    assert(pkg.dependencies["fake-pkg"]).equals("^1.0.0");

    await testRoot.remove();
  });

  test.case("real run should not abort when install fails (no lock file)", async assert => {
    await reset();
    await testRoot.append("/package.json").write(JSON.stringify({
      name: "test-project",
      version: "1.0.0",
    }));

    await createPowerup("no-lock-dep", [], { packageDependencies: [{ dependencies: ["fake-pkg@^1.0.0"] }] });

    const output = await captureStdout(async () => {
      await use.run({
        subcommands: ["no-lock-dep"],
        flags: [],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    });

    assert(output.includes("No lock file detected")).true();
    const pkg = JSON.parse(await testRoot.append("/package.json").text());
    assert(pkg.dependencies["fake-pkg"]).equals("^1.0.0");

    await testRoot.remove();
  });
});

test.group("apply rollback", () => {
  test.case("should roll back on error with no files changed in project", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/Existing.ts").write("old content");

    await createPowerup("rollback-test", [
      { type: "create", name: "first", template: "first.njk", outputPath: ".test-output/NewFile.ts" },
    ], { required: ["ComponentName"] });
    // Don't write the template — this will cause template_not_found error
    await multiUseFolder.append("/rollback-test/first.njk").remove();

    let threw;
    try {
      await use.run({
        subcommands: ["rollback-test"],
        flags: [{ flag: "--component-name", value: "Test" }],
        context: { root: testRoot, globalRoot: tempGlobalRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(UseErrorCode.invalid_composition);

    // The new file should NOT exist in the project (rollback happened)
    assert(await fs.exists(testRoot.append("/.test-output/NewFile.ts"))).false();

    await testRoot.remove();
  });
});

test.group("apply delete", () => {
  test.case("should delete a file from the project root", async assert => {
    await reset();

    // Create the target file and commit to git so it appears in worktree
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/legacy.ts").write("export const legacy = true;");
    await gitCommit(testRoot, "add legacy file");

    await createPowerup("delete-test", [
      { type: "delete", name: "legacy", outputPath: ".test-output/legacy.ts" },
    ]);

    await use.run({
      subcommands: ["delete-test"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    const legacyPath = testRoot.append("/.test-output/legacy.ts");

    assert(await fs.exists(legacyPath)).false();

    await testRoot.remove();
  });

  test.case("should delete alongside create and modify in one run", async assert => {
    await reset();

    // Create files to modify and delete, then commit
    await fs.create(testRoot.append("/.test-output"));

    await testRoot.append("/.test-output/index.ts").write("export const x = 1;\n");
    await testRoot.append("/.test-output/old.ts").write("old content");

    await gitCommit(testRoot, "add target files");

    await createPowerup("mixed-ops", [
      { type: "create", name: "new-file", template: "new.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
      { type: "delete", name: "old", outputPath: ".test-output/old.ts" },
    ]);
    // Override with required variables
    await multiUseFolder.append("/mixed-ops/instructions.json").writeJSON({
      name: "mixed-ops",
      description: "test description",
      variables: { required: ["ComponentName"] },
      intent: [],
      steps: [
        { type: "create", name: "new-file", template: "new.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
        { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
        { type: "delete", name: "old", outputPath: ".test-output/old.ts" },
      ],
    } as never);

    await multiUseFolder.append("/mixed-ops/new.njk").write("export const {{componentName}} = 1;");
    await multiUseFolder.append("/mixed-ops/wire.json")
      .write('[{"where":"top","content":"// header\\n"}]');
    await gitCommit(testRoot, "add templates");

    await use.run({
      subcommands: ["mixed-ops"],
      flags: [{ flag: "--component-name", value: "Widget" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    });

    // Create happened
    assert(await fs.exists(testRoot.append("/.test-output/Widget.ts"))).true();
    // Modify happened
    const indexContent = await testRoot.append("/.test-output/index.ts").text();
    assert(indexContent.includes("// header")).true();
    // Delete happened
    assert(await fs.exists(testRoot.append("/.test-output/old.ts"))).false();

    await testRoot.remove();
  });

  test.case("should print a warning and skip when delete target does not exist", async assert => {
    await reset();

    await createPowerup("delete-missing", [
      { type: "delete", name: "nonexistent", outputPath: ".test-output/never-existed.ts" },
    ]);

    const output = await captureStdout(() => use.run({
      subcommands: ["delete-missing"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("Warning: file not found, skipping: .test-output/never-existed.ts");
    // No error thrown, no file created
    assert(await fs.exists(testRoot.append("/.test-output/never-existed.ts"))).false();

    await testRoot.remove();
  });

  test.case("should apply delete and warn on failed modify (non-atomic)", async assert => {
    await reset();

    // Create a file to delete and a target file for the failing suboutput modify
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/to-delete.ts").write("delete me");
    await testRoot.append("/.test-output/target.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target files");

    // Create child with a modify that will fail at apply time (bad anchor)
    await createPowerup("failing-child", [
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/target.ts" },
    ]);
    await multiUseFolder.append("/failing-child/wire.json")
      .write('[{"where":"NONEXISTENT_ANCHOR","content":"hello"}]');

    // Create parent with a delete entry and the failing suboutput.
    // The delete runs before the include step, so the delete succeeds
    // in the worktree, then the suboutput modify fails — but now it warns
    // and continues instead of aborting, so the delete is still applied.
    await createPowerup("atomic-delete-parent", [
      { type: "delete", name: "del", outputPath: ".test-output/to-delete.ts" },
      { type: "include", name: "failing-child", variables: {} },
    ]);

    const output = await captureStdout(() => use.run({
      subcommands: ["atomic-delete-parent"],
      flags: [],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    // The modify failure should produce a warning
    assert(output).includes("Warning: skipped modification");
    assert(output).includes("Anchor \"NONEXISTENT_ANCHOR\" not found");

    // The delete should have been applied (file no longer exists)
    assert(await fs.exists(testRoot.append("/.test-output/to-delete.ts"))).false();

    await testRoot.remove();
  });
});

test.group("apply delete dry-run", () => {
  test.case("should print 'Would delete' without deleting the file", async assert => {
    await reset();

    // Create the target file and commit to git
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/legacy.ts").write("export const legacy = true;");
    await gitCommit(testRoot, "add legacy file");

    await createPowerup("dry-delete", [
      { type: "delete", name: "legacy", outputPath: ".test-output/legacy.ts" },
    ]);

    const output = await captureStdout(() => use.run({
      subcommands: ["dry-delete"],
      flags: [{ flag: "--dry-run", value: "true" }],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("=== .test-output/legacy.ts (delete) ===");
    assert(output).includes("Would delete");

    // File should NOT be deleted
    assert(await fs.exists(testRoot.append("/.test-output/legacy.ts"))).true();

    await testRoot.remove();
  });

  test.case("should print create, modify, and delete in dry-run", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("line1\n");
    await testRoot.append("/.test-output/old.ts").write("old");
    await gitCommit(testRoot, "add target files");

    await createPowerup("dry-mixed", [
      { type: "create", name: "new", template: "new.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
      { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
      { type: "delete", name: "old", outputPath: ".test-output/old.ts" },
    ]);
    // Override with required variables
    await multiUseFolder.append("/dry-mixed/instructions.json").writeJSON({
      name: "dry-mixed",
      description: "test description",
      variables: { required: ["ComponentName"] },
      intent: [],
      steps: [
        { type: "create", name: "new", template: "new.njk", outputPath: ".test-output/{{ComponentName}}.ts" },
        { type: "modify", name: "wire", template: "wire.json", outputPath: ".test-output/index.ts" },
        { type: "delete", name: "old", outputPath: ".test-output/old.ts" },
      ],
    } as never);

    await multiUseFolder.append("/dry-mixed/new.njk").write("const {{componentName}} = 1;");
    await multiUseFolder.append("/dry-mixed/wire.json")
      .write('[{"where":"top","content":"// header\\n"}]');

    const output = await captureStdout(() => use.run({
      subcommands: ["dry-mixed"],
      flags: [
        { flag: "--dry-run", value: "true" },
        { flag: "--component-name", value: "Widget" },
      ],
      context: { root: testRoot, globalRoot: tempGlobalRoot },
    }));

    assert(output).includes("=== .test-output/Widget.ts ===");
    assert(output).includes("=== .test-output/index.ts (modify) ===");
    assert(output).includes("=== .test-output/old.ts (delete) ===");
    assert(output).includes("Would delete");

    // No files changed
    assert(await fs.exists(testRoot.append("/.test-output/old.ts"))).true();
    assert((await testRoot.append("/.test-output/index.ts").text()).trim()).equals("line1");

    await testRoot.remove();
  });
});