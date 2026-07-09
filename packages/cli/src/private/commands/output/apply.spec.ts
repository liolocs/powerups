import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import createApplyCommand from "#commands/output/apply";
import createCreateCommand from "#commands/output/create";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { OutputTemplateApplyErrorCode } from "#errors/outputApplyErrors";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { readMetrics } from "#utils/metrics";
import {
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  TEMPLATE_FOLDER,
} from "#constants";

const execAsync = promisify(exec);

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const templateFolder: FileRef = mainFolder.append(`/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

const apply = createApplyCommand("template");
const createCmd = createCreateCommand("template");

async function gitInit(dir: FileRef): Promise<void> {
  await execAsync("git init", { cwd: dir.path });
  await execAsync("git config user.email test@test.com", { cwd: dir.path });
  await execAsync("git config user.name test", { cwd: dir.path });
  await dir.append("/README.md").write("init");
  await execAsync("git add -A", { cwd: dir.path });
  await execAsync("git commit -m init", { cwd: dir.path });
}

async function gitCommit(dir: FileRef, message: string): Promise<void> {
  await execAsync("git add -A", { cwd: dir.path });
  try {
    await execAsync(`git commit -m "${message}"`, { cwd: dir.path });
  } catch {
    // Nothing to commit — that's fine
  }
}

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
  await fs.create(templateFolder);
  await gitInit(testRoot);
}

test.case("apply writes rendered .njk template files to outputPath",
  async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ui-component" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    const tmplPath = templateFolder.append("/ui-component/button.njk");
    await tmplPath.write("<button>{{componentName}}</button>");

    await apply.run({
      subcommands: ["ui-component"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot },
    });

    const outPath = testRoot.append("/.test-output/Button.svelte");
    assert(await fs.exists(outPath)).true();
    assert((await outPath.text()).trimEnd()).equals("<button>Button</button>");

    await testRoot.remove();
  });

test.case("apply writes rendered .ts template files to outputPath",
  async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ts-output" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "component.ts",
            template: "component.ts",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    const tmplPath = templateFolder.append("/ts-output/component.ts");
    await tmplPath.write(
      "export default function({ componentName }: Record<string, string>) {\n" +
      "  return `export const ${componentName} = '${componentName}';`;\n" +
      "}\n",
    );

    await apply.run({
      subcommands: ["ts-output"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot },
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

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "overwrite-test" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "f",
          template: "f.njk",
          outputPath: ".test-output/{{ComponentName}}.ts",
        }],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });
  await templateFolder.append("/overwrite-test/f.njk").write("new content {{componentName}}");

  await apply.run({
    subcommands: ["overwrite-test"],
    flags: [
      { flag: "--component-name", value: "Existing" },
      { flag: "--overwrite", value: "true" },
    ],
    context: { root: testRoot },
  });

  const outPath = testRoot.append("/.test-output/Existing.ts");
  assert((await outPath.text()).trimEnd()).equals("new content Existing");

  await testRoot.remove();
});

test.group("apply errors", () => {
  test.case("should fail with dry_folder_not_found without .saved folder", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);
    await gitInit(testRoot);

    let threw;
    try {
      await apply.run({
        subcommands: ["anything"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with missing_name when no positional arg given",
    async assert => {
      await reset();

      let threw = false;
      try {
        await apply.run({
          subcommands: [],
          flags: [],
          context: { root: testRoot },
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
      flags: [{ flag: "--name", value: "real" }],
      context: { root: testRoot },
    });

    try {
      await apply.run({
        subcommands: ["nonexistent"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e) {
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("not_found");
    }

    await testRoot.remove();
  });

  test.case("should fail with missing_variable when a required variable is omitted",
    async assert => {
      await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "needs-vars" },
          { flag: "--variables", value: "ComponentName,theme" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "button.svelte",
              template: "button.njk",
              outputPath: ".test-output/{{ComponentName}}.svelte",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });

      const tmplPath = templateFolder.append("/needs-vars/button.njk");
      await tmplPath.write("<button>{{componentName}} {{theme}}</button>");

      let threw = false;
      try {
        await apply.run({
          subcommands: ["needs-vars"],
          flags: [{ flag: "--component-name", value: "Button" }],
          context: { root: testRoot },
          // Missing --theme
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code).equals("missing_variable");
        assert((e as Error).message).includes("theme");
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should fail with invalid_composition when a template file is missing",
    async assert => {
      await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "missing-tmpl" },
          { flag: "--variables", value: "ComponentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "button.svelte",
              template: "button.njk",
              outputPath: ".test-output/{{ComponentName}}.svelte",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });

      // Remove the template file
      const tmplPath = templateFolder.append("/missing-tmpl/button.njk");
      await tmplPath.remove();

      let threw = false;
      try {
        await apply.run({
          subcommands: ["missing-tmpl"],
          flags: [{ flag: "--component-name", value: "Button" }],
          context: { root: testRoot },
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code).equals("invalid_composition");
        assert((e as Error).message).includes("missing template file");
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should fail with modify_target_not_found when the target file doesn't exist", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "no-target" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/nonexistent.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/no-target/wire.json")
      .write('[{"where":"top","content":"hello"}]');

    let threw = false;
    try {
      await apply.run({
        subcommands: ["no-target"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("modify_target_not_found");
    }
    assert(threw).true();

    await testRoot.remove();
  });

  test.case("should fail with modify_anchor_not_found when the anchor doesn't exist in the target", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target file");

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "anchor-missing" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await gitCommit(testRoot, "add template");

    await templateFolder.append("/anchor-missing/wire.json")
      .write('[{"where":"NONEXISTENT_ANCHOR","content":"hello"}]');
    await gitCommit(testRoot, "add modify template");

    let threw;
    try {
      await apply.run({
        subcommands: ["anchor-missing"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.modify_anchor_not_found);

    await testRoot.remove();
  });

  test.case("should fail with modify_anchor_ambiguous when the anchor appears multiple times", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target file");

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "anchor-ambiguous" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await gitCommit(testRoot, "add template");

    // Target file contains the anchor string twice
    await testRoot.append("/.test-output/index.ts").write("export const x = 1;\nexport const y = 2;");
    await gitCommit(testRoot, "update target file");

    await templateFolder.append("/anchor-ambiguous/wire.json")
      .write('[{"where":"export","content":"// replaced"}]');
    await gitCommit(testRoot, "add modify template");

    let threw;
    try {
      await apply.run({
        subcommands: ["anchor-ambiguous"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.modify_anchor_ambiguous);

    await testRoot.remove();
  });

  test.case("should fail with destination_file_exists when target exists without --overwrite", async assert => {
    await reset();

    // Create the target file first and commit to git so it appears in worktree
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/Existing.ts").write("old content");
    await gitCommit(testRoot, "add existing file");

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "no-overwrite-test" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "f",
            template: "f.njk",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });
    await templateFolder.append("/no-overwrite-test/f.njk").write("new content");

    let threw = false;
    try {
      await apply.run({
        subcommands: ["no-overwrite-test"],
        flags: [{ flag: "--component-name", value: "Existing" }],
        context: { root: testRoot },
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
    const noGitRoot = fs.ref(path.join(tmpdir(), `saved-test-nogit-${randomBytes(4).toString("hex")}`));
    await fs.create(noGitRoot);
    await fs.create(noGitRoot.append(`/${MAIN_FOLDER}`));
    await fs.create(noGitRoot.append(`/${MAIN_FOLDER}/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`));

    const noGitTemplateFolder = noGitRoot.append(`/${MAIN_FOLDER}/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "no-git" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "f",
            template: "f.njk",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
          modify: [],
        }) },
      ],
      context: { root: noGitRoot },
    });
    await noGitTemplateFolder.append("/no-git/f.njk").write("hello {{componentName}}");

    let threw;
    try {
      await apply.run({
        subcommands: ["no-git"],
        flags: [{ flag: "--component-name", value: "Button" }],
        context: { root: noGitRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.git_repo_required);

    await noGitRoot.remove();
  });
});

test.group("apply dry-run", () => {
  test.case("should print to stdout without writing files",
    async assert => {
      await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "dry-run-test" },
          { flag: "--variables", value: "ComponentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "button.svelte",
              template: "button.njk",
              outputPath: ".test-output/{{ComponentName}}.svelte",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });

      const tmplPath = templateFolder.append("/dry-run-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      const output = await captureStdout(() => apply.run({
        subcommands: ["dry-run-test"],
        flags: [
          { flag: "--dry-run", value: "true" },
          { flag: "--component-name", value: "Button" },
        ],
        context: { root: testRoot },
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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-modify" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/dry-modify/wire.json")
      .write('[{"where":"top","content":"// header"}]');

    const output = await captureStdout(() => apply.run({
      subcommands: ["dry-modify"],
      flags: [{ flag: "--dry-run", value: "true" }],
      context: { root: testRoot },
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
      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "shadcn-button" },
          { flag: "--variables", value: "componentName,theme" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "component",
              template: "component.njk",
              outputPath: ".test-output/{{componentName}}.tsx",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/shadcn-button/component.njk")
        .write("export const {{componentName}} = '{{theme}}';");

      // Create parent template (all components) with includes
      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "shadcn-all" },
          { flag: "--variables", value: "theme" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "barrel",
              template: "barrel.njk",
              outputPath: ".test-output/index.ts",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/shadcn-all/barrel.njk")
        .write("export { Button, Input } from './';");

      // Add includes to parent
      await templateFolder.append("/shadcn-all/instructions.json").writeJSON({
        name: "shadcn-all",
        variables: ["theme"],
        intent: [],
        output: {
          create: [{
            name: "barrel",
            template: "barrel.njk",
            outputPath: ".test-output/index.ts",
          }],
          modify: [],
        },
        includes: [
          {
            name: "shadcn-button",
            variables: { componentName: "Button", theme: "{{theme}}" },
          },
          {
            name: "shadcn-button",
            variables: { componentName: "Input", theme: "{{theme}}" },
          },
        ],
      });

      await apply.run({
        subcommands: ["shadcn-all"],
        flags: [{ flag: "--theme", value: "dark" }],
        context: { root: testRoot },
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

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "dry-child" },
          { flag: "--variables", value: "componentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "comp",
              template: "comp.njk",
              outputPath: ".test-output/{{componentName}}.ts",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/dry-child/comp.njk")
        .write("const {{componentName}} = 1;");

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "dry-parent" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/dry-parent/barrel.njk").write("barrel");

      await templateFolder.append("/dry-parent/instructions.json").writeJSON({
        name: "dry-parent",
        variables: [],
        intent: [],
        output: {
          create: [{
            name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts",
          }],
          modify: [],
        },
        includes: [
          { name: "dry-child", variables: { componentName: "Button" } },
        ],
      });

      const output = await captureStdout(() => apply.run({
        subcommands: ["dry-parent"],
        flags: [{ flag: "--dry-run", value: "true" }],
        context: { root: testRoot },
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

      await createCmd.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "bad-parent" }],
        context: { root: testRoot },
      });
      await templateFolder.append("/bad-parent/instructions.json").writeJSON({
        name: "bad-parent",
        variables: [],
        intent: [],
        output: { create: [], modify: [] },
        includes: [{ name: "nonexistent", variables: {} }],
      });

      let threw = false;
      try {
        await apply.run({
          subcommands: ["bad-parent"],
          flags: [],
          context: { root: testRoot },
        });
      } catch (e) {
        threw = true;
        assert(e instanceof CodeError).true();
        assert((e as CodeError).code).equals("invalid_composition");
        assert((e as Error).message).includes("suboutput not found: nonexistent");
      }
      assert(threw).true();

      await testRoot.remove();
    });

  test.case("should write to overridden location with output path override",
    async assert => {
      await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "override-child" },
          { flag: "--variables", value: "componentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "comp",
              template: "comp.njk",
              outputPath: ".test-output/original/{{componentName}}.tsx",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/override-child/comp.njk")
        .write("const {{componentName}} = 1;");

      await createCmd.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "override-parent" }],
        context: { root: testRoot },
      });
      await templateFolder.append("/override-parent/instructions.json").writeJSON({
        name: "override-parent",
        variables: [],
        intent: [],
        output: { create: [], modify: [] },
        includes: [
          {
            name: "override-child",
            variables: { componentName: "Button" },
            outputPathOverride: { create: { comp: ".test-output/overridden/{{componentName}}.tsx" } },
          },
        ],
      });

      await apply.run({
        subcommands: ["override-parent"],
        flags: [],
        context: { root: testRoot },
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

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "dual-child" },
          { flag: "--variables", value: "componentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "comp",
              template: "comp.njk",
              outputPath: ".test-output/{{componentName}}.tsx",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });
      await templateFolder.append("/dual-child/comp.njk")
        .write("export const {{componentName}} = 1;");

      await createCmd.run({
        subcommands: [],
        flags: [{ flag: "--name", value: "dual-parent" }],
        context: { root: testRoot },
      });
      await templateFolder.append("/dual-parent/instructions.json").writeJSON({
        name: "dual-parent",
        variables: [],
        intent: [],
        output: { create: [], modify: [] },
        includes: [
          { name: "dual-child", variables: { componentName: "Primary" } },
          { name: "dual-child", variables: { componentName: "Secondary" } },
        ],
      });

      await apply.run({
        subcommands: ["dual-parent"],
        flags: [],
        context: { root: testRoot },
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
});

test.group("apply modify", () => {
  test.case("should modify an existing file", async assert => {
    await reset();

    // Create the target file and commit to git so it appears in worktree
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/index.ts").write("line1\nline2\nline3\n");
    await gitCommit(testRoot, "add target file");

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "modify-test" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    // Write the modify template
    await templateFolder.append("/modify-test/wire.json")
      .write('[{"where":"top","content":"// header\\n"},{"where":{"after":"line1"},"content":"inserted"}]');

    await apply.run({
      subcommands: ["modify-test"],
      flags: [],
      context: { root: testRoot },
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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "njk-modify" },
        { flag: "--variables", value: "name" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.njk",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/njk-modify/wire.njk")
      .write('[{"where":"top","content":"import { {{name}} } from \\"./{{name}}\\";\\n"}]');

    await apply.run({
      subcommands: ["njk-modify"],
      flags: [{ flag: "--name", value: "User" }],
      context: { root: testRoot },
    });

    const outPath = testRoot.append("/.test-output/index.ts");
    assert((await outPath.text()).trim()).equals('import { User } from "./User";\nexport const x = 1;');

    await testRoot.remove();
  });
});

test.group("apply metrics", () => {
  test.case("should log metrics on a successful run",
    async assert => {
      await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "metrics-test" },
          { flag: "--variables", value: "ComponentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "button.svelte",
              template: "button.njk",
              outputPath: ".test-output/{{ComponentName}}.svelte",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });

      const tmplPath = templateFolder.append("/metrics-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      await apply.run({
        subcommands: ["metrics-test"],
        flags: [{ flag: "--component-name", value: "Button" }],
        context: { root: testRoot },
      });

      const entries = await readMetrics(testRoot);
      assert(entries.length).equals(1);
      assert(entries[0].output).equals("metrics-test");
      assert(entries[0].characters).equals("<button>Button</button>\n".length);

      await testRoot.remove();
    });

  test.case("should not log metrics on dry-run", async assert => {
    await reset();

      await createCmd.run({
        subcommands: [],
        flags: [
          { flag: "--name", value: "dry-metrics-test" },
          { flag: "--variables", value: "ComponentName" },
          { flag: "--output", value: JSON.stringify({
            create: [{
              name: "button.svelte",
              template: "button.njk",
              outputPath: ".test-output/{{ComponentName}}.svelte",
            }],
            modify: [],
          }) },
        ],
        context: { root: testRoot },
      });

      const tmplPath = templateFolder.append("/dry-metrics-test/button.njk");
      await tmplPath.write("<button>{{componentName}}</button>");

      await apply.run({
        subcommands: ["dry-metrics-test"],
        flags: [
          { flag: "--dry-run", value: "true" },
          { flag: "--component-name", value: "Button" },
        ],
        context: { root: testRoot },
      });

      const entries = await readMetrics(testRoot);
      assert(entries.length).equals(0);

      await testRoot.remove();
    });
});

test.group("apply rollback", () => {
  test.case("should roll back on error with no files changed in project", async assert => {
    await reset();

    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/Existing.ts").write("old content");

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "rollback-test" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "first",
            template: "first.njk",
            outputPath: ".test-output/NewFile.ts",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });
    // Don't write the template — this will cause template_not_found error
    await templateFolder.append("/rollback-test/first.njk").remove();

    let threw;
    try {
      await apply.run({
        subcommands: ["rollback-test"],
        flags: [{ flag: "--component-name", value: "Test" }],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.invalid_composition);

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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "delete-test" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [],
          delete: [{ name: "legacy", outputPath: ".test-output/legacy.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });

    await apply.run({
      subcommands: ["delete-test"],
      flags: [],
      context: { root: testRoot },
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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "mixed-ops" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "new-file",
            template: "new.njk",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
          delete: [{ name: "old", outputPath: ".test-output/old.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/mixed-ops/new.njk").write("export const {{componentName}} = 1;");
    await templateFolder.append("/mixed-ops/wire.json")
      .write('[{"where":"top","content":"// header\\n"}]');
    await gitCommit(testRoot, "add templates");

    await apply.run({
      subcommands: ["mixed-ops"],
      flags: [{ flag: "--component-name", value: "Widget" }],
      context: { root: testRoot },
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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "delete-missing" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [],
          delete: [{ name: "nonexistent", outputPath: ".test-output/never-existed.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });

    const output = await captureStdout(() => apply.run({
      subcommands: ["delete-missing"],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("Warning: file not found, skipping: .test-output/never-existed.ts");
    // No error thrown, no file created
    assert(await fs.exists(testRoot.append("/.test-output/never-existed.ts"))).false();

    await testRoot.remove();
  });

  test.case("should roll back on error after a delete (atomicity)", async assert => {
    await reset();

    // Create a file to delete and a target file for the failing suboutput modify
    await fs.create(testRoot.append("/.test-output"));
    await testRoot.append("/.test-output/to-delete.ts").write("delete me");
    await testRoot.append("/.test-output/target.ts").write("export const x = 1;");
    await gitCommit(testRoot, "add target files");

    // Create child with a modify that will fail at apply time (bad anchor)
    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "failing-child" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/target.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await templateFolder.append("/failing-child/wire.json")
      .write('[{"where":"NONEXISTENT_ANCHOR","content":"hello"}]');

    // Create parent with a delete entry and the failing suboutput.
    // The delete runs before the suboutput tasks, so the delete succeeds
    // in the worktree, then the suboutput modify fails, triggering rollback.
    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "atomic-delete-parent" }],
      context: { root: testRoot },
    });
    await templateFolder.append("/atomic-delete-parent/instructions.json").writeJSON({
      name: "atomic-delete-parent",
      variables: [],
      intent: [],
      output: {
        create: [],
        modify: [],
        delete: [{ name: "del", outputPath: ".test-output/to-delete.ts" }],
      },
      includes: [{ name: "failing-child", variables: {} }],
    });

    let threw;
    try {
      await apply.run({
        subcommands: ["atomic-delete-parent"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateApplyErrorCode.modify_anchor_not_found);

    // The file should STILL exist in the project (worktree was discarded — delete was in worktree only)
    assert(await fs.exists(testRoot.append("/.test-output/to-delete.ts"))).true();

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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-delete" },
        { flag: "--output", value: JSON.stringify({
          create: [],
          modify: [],
          delete: [{ name: "legacy", outputPath: ".test-output/legacy.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });

    const output = await captureStdout(() => apply.run({
      subcommands: ["dry-delete"],
      flags: [{ flag: "--dry-run", value: "true" }],
      context: { root: testRoot },
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

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-mixed" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "new",
            template: "new.njk",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
          modify: [{
            name: "wire",
            template: "wire.json",
            outputPath: ".test-output/index.ts",
          }],
          delete: [{ name: "old", outputPath: ".test-output/old.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/dry-mixed/new.njk").write("const {{componentName}} = 1;");
    await templateFolder.append("/dry-mixed/wire.json")
      .write('[{"where":"top","content":"// header\\n"}]');

    const output = await captureStdout(() => apply.run({
      subcommands: ["dry-mixed"],
      flags: [
        { flag: "--dry-run", value: "true" },
        { flag: "--component-name", value: "Widget" },
      ],
      context: { root: testRoot },
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