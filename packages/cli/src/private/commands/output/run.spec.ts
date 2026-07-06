import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import run from "#commands/output/run";
import generate from "#commands/output/generate";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";
import { readMetrics } from "#utils/metrics";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const outputsFolder: FileRef = mainFolder.append(`/${OUTPUTS_FOLDER}`);
const outputDir: FileRef = testRoot.append("/.test-output");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

test.case("run writes rendered .njk template files to outputPath",
  async assert => {
    await reset();

    // Create a output with a .njk template. Output goes into the dedicated
    // .test-output directory, not the real src/ tree.
    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ui-component" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    // Write the .njk template content
    const templatePath = outputsFolder.append("/ui-component/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    // Run the output
    await run.run({
      subcommands: ["ui-component"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot },
    });

    // Verify the file was written. @rcompat/fs .write() ensures files end
    // with a trailing newline, so trim before comparing rendered content.
    const outputPath = testRoot.append("/.test-output/Button.svelte");
    assert(await fs.exists(outputPath)).true();
    assert((await outputPath.text()).trimEnd()).equals("<button>Button</button>");

    await testRoot.remove();
  });

test.case("run writes rendered .ts template files to outputPath",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ts-output" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "component.ts",
            template: "component.ts",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    // Write the .ts template
    const templatePath = outputsFolder.append("/ts-output/component.ts");
    await templatePath.write(
      "export default function({ componentName }: Record<string, string>) {\n" +
      "  return `export const ${componentName} = '${componentName}';`;\n" +
      "}\n",
    );

    await run.run({
      subcommands: ["ts-output"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot },
    });

    const outputPath = testRoot.append("/.test-output/Button.ts");
    assert(await fs.exists(outputPath)).true();
    assert((await outputPath.text()).trimEnd()).equals("export const Button = 'Button';");

    await testRoot.remove();
  });

test.case("run --dry-run prints to stdout without writing files",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-run-test" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    const templatePath = outputsFolder.append("/dry-run-test/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    const output = await captureStdout(() => run.run({
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
    const outputPath = testRoot.append("/.test-output/Button.svelte");
    assert(await fs.exists(outputPath)).false();

    await testRoot.remove();
  });

test.case("run throws output_not_found for missing output", async assert => {
  await reset();

  // Create one output so .saved/outputs exists
  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "real" }],
    context: { root: testRoot },
  });

  let threw = false;
  try {
    await run.run({
      subcommands: ["nonexistent"],
      flags: [],
      context: { root: testRoot },
    });
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("output_not_found");
  }
  assert(threw).true();

  await testRoot.remove();
});

test.case("run throws missing_output_name with no positional arg",
  async assert => {
    await reset();

    let threw = false;
    try {
      await run.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("missing_output_name");
    }
    assert(threw).true();

    await testRoot.remove();
  });

test.case("run throws missing_variable when required variable not provided",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "needs-vars" },
        { flag: "--variables", value: "ComponentName,theme" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    const templatePath = outputsFolder.append("/needs-vars/button.njk");
    await templatePath.write("<button>{{componentName}} {{theme}}</button>");

    let threw = false;
    try {
      await run.run({
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

test.case("run throws invalid_composition when template file is missing",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "missing-tmpl" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    // Remove the template file
    const templatePath = outputsFolder.append("/missing-tmpl/button.njk");
    await templatePath.remove();

    let threw = false;
    try {
      await run.run({
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

test.case("run errors without .saved folder", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw = false;
  try {
    await run.run({
      subcommands: ["anything"],
      flags: [],
      context: { root: testRoot },
    });
  } catch {
    threw = true;
  }
  assert(threw).true();

  await testRoot.remove();
});

test.case("run logs metrics to .saved/metrics.jsonl on successful run",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "metrics-test" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "button.svelte",
            template: "button.njk",
            outputPath: ".test-output/{{ComponentName}}.svelte",
          }],
        }) },
      ],
      context: { root: testRoot },
    });

    const templatePath = outputsFolder.append("/metrics-test/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    await run.run({
      subcommands: ["metrics-test"],
      flags: [{ flag: "--component-name", value: "Button" }],
      context: { root: testRoot },
    });

    const entries = await readMetrics(testRoot);
    assert(entries.length).equals(1);
    assert(entries[0].output).equals("metrics-test");
    // FileRef.write() adds a trailing newline to the template file, so the
    // rendered output includes it: "<button>Button</button>\n" (24 chars)
    assert(entries[0].characters).equals("<button>Button</button>\n".length);

    await testRoot.remove();
  });

test.case("run does not log metrics on dry-run", async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "dry-metrics-test" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        files: [{
          name: "button.svelte",
          template: "button.njk",
          outputPath: ".test-output/{{ComponentName}}.svelte",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  const templatePath = outputsFolder.append("/dry-metrics-test/button.njk");
  await templatePath.write("<button>{{componentName}}</button>");

  await run.run({
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

test.case("run composite output writes files from parent and suboutputs",
  async assert => {
    await reset();

    // Create child output (button component)
    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "shadcn-button" },
        { flag: "--variables", value: "componentName,theme" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "component",
            template: "component.njk",
            outputPath: ".test-output/{{componentName}}.tsx",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/shadcn-button/component.njk")
      .write("export const {{componentName}} = '{{theme}}';");

    // Create parent output (all components) with includes
    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "shadcn-all" },
        { flag: "--variables", value: "theme" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "barrel",
            template: "barrel.njk",
            outputPath: ".test-output/index.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/shadcn-all/barrel.njk")
      .write("export { Button, Input } from './';");

    // Add includes to parent
    await outputsFolder.append("/shadcn-all/instructions.json").writeJSON({
      name: "shadcn-all",
      variables: ["theme"],
      intent: [],
      output: {
        files: [{
          name: "barrel",
          template: "barrel.njk",
          outputPath: ".test-output/index.ts",
        }],
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

    await run.run({
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

test.case("run composite output with --dry-run prints all outputs without writing",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-child" },
        { flag: "--variables", value: "componentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "comp",
            template: "comp.njk",
            outputPath: ".test-output/{{componentName}}.ts",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/dry-child/comp.njk")
      .write("const {{componentName}} = 1;");

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dry-parent" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts" }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/dry-parent/barrel.njk").write("barrel");

    await outputsFolder.append("/dry-parent/instructions.json").writeJSON({
      name: "dry-parent",
      variables: [],
      intent: [],
      output: {
        files: [{
          name: "barrel", template: "barrel.njk", outputPath: ".test-output/index.ts",
        }],
      },
      includes: [
        { name: "dry-child", variables: { componentName: "Button" } },
      ],
    });

    const output = await captureStdout(() => run.run({
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

test.case("run composite output throws invalid_composition for missing suboutput",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "bad-parent" }],
      context: { root: testRoot },
    });
    await outputsFolder.append("/bad-parent/instructions.json").writeJSON({
      name: "bad-parent",
      variables: [],
      intent: [],
      output: { files: [] },
      includes: [{ name: "nonexistent", variables: {} }],
    });

    let threw = false;
    try {
      await run.run({
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

test.case("run composite output throws invalid_composition for circular reference",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "cycle-a" }],
      context: { root: testRoot },
    });
    await generate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "cycle-b" }],
      context: { root: testRoot },
    });

    await outputsFolder.append("/cycle-a/instructions.json").writeJSON({
      name: "cycle-a",
      variables: [],
      intent: [],
      output: { files: [] },
      includes: [{ name: "cycle-b", variables: {} }],
    });
    await outputsFolder.append("/cycle-b/instructions.json").writeJSON({
      name: "cycle-b",
      variables: [],
      intent: [],
      output: { files: [] },
      includes: [{ name: "cycle-a", variables: {} }],
    });

    let threw = false;
    try {
      await run.run({
        subcommands: ["cycle-a"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("invalid_composition");
      assert((e as Error).message).includes("circular reference");
    }
    assert(threw).true();

    await testRoot.remove();
  });

test.case("run composite output with output path override writes to overridden location",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "override-child" },
        { flag: "--variables", value: "componentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "comp",
            template: "comp.njk",
            outputPath: ".test-output/original/{{componentName}}.tsx",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/override-child/comp.njk")
      .write("const {{componentName}} = 1;");

    await generate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "override-parent" }],
      context: { root: testRoot },
    });
    await outputsFolder.append("/override-parent/instructions.json").writeJSON({
      name: "override-parent",
      variables: [],
      intent: [],
      output: { files: [] },
      includes: [
        {
          name: "override-child",
          variables: { componentName: "Button" },
          files: { comp: ".test-output/overridden/{{componentName}}.tsx" },
        },
      ],
    });

    await run.run({
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

test.case("run composite output with same suboutput twice writes both sets of files",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "dual-child" },
        { flag: "--variables", value: "componentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "comp",
            template: "comp.njk",
            outputPath: ".test-output/{{componentName}}.tsx",
          }],
        }) },
      ],
      context: { root: testRoot },
    });
    await outputsFolder.append("/dual-child/comp.njk")
      .write("export const {{componentName}} = 1;");

    await generate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "dual-parent" }],
      context: { root: testRoot },
    });
    await outputsFolder.append("/dual-parent/instructions.json").writeJSON({
      name: "dual-parent",
      variables: [],
      intent: [],
      output: { files: [] },
      includes: [
        { name: "dual-child", variables: { componentName: "Primary" } },
        { name: "dual-child", variables: { componentName: "Secondary" } },
      ],
    });

    await run.run({
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