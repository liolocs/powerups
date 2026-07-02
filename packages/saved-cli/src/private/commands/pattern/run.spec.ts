import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import run from "#commands/pattern/run";
import generate from "#commands/pattern/generate";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";
import { readMetrics } from "#utils/metrics";

const root = await runtime.projectRoot();
const mainFolder: FileRef = root.append(`/${MAIN_FOLDER}`);
const patternsFolder: FileRef = mainFolder.append(`/${PATTERNS_FOLDER}`);
// Dedicated test output directory — never write into the real package `src/`
// folder (projectRoot resolves to packages/saved-cli, whose own source lives
// under src/). Removing src/ wholesale would delete the package source.
const outputDir: FileRef = root.append("/.test-output");

async function reset() {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  await fs.create(mainFolder);
  if (await fs.exists(outputDir)) {
    await outputDir.remove();
  }
}

test.case("run writes rendered .njk template files to outputPath",
  async assert => {
    await reset();

    // Create a pattern with a .njk template. Output goes into the dedicated
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
    });

    // Write the .njk template content
    const templatePath = patternsFolder.append("/ui-component/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    // Run the pattern
    await run.run({
      subcommands: ["ui-component"],
      flags: [{ flag: "--component-name", value: "Button" }],
    });

    // Verify the file was written. @rcompat/fs .write() ensures files end
    // with a trailing newline, so trim before comparing rendered content.
    const outputPath = root.append("/.test-output/Button.svelte");
    assert(await fs.exists(outputPath)).true();
    assert((await outputPath.text()).trimEnd()).equals("<button>Button</button>");

    // Cleanup: only the test output dir + .saved, never the real src/
    await mainFolder.remove();
    await outputDir.remove();
  });

test.case("run writes rendered .ts template files to outputPath",
  async assert => {
    await reset();

    await generate.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ts-pattern" },
        { flag: "--variables", value: "ComponentName" },
        { flag: "--output", value: JSON.stringify({
          files: [{
            name: "component.ts",
            template: "component.ts",
            outputPath: ".test-output/{{ComponentName}}.ts",
          }],
        }) },
      ],
    });

    // Write the .ts template
    const templatePath = patternsFolder.append("/ts-pattern/component.ts");
    await templatePath.write(
      "export default function({ componentName }: Record<string, string>) {\n" +
      "  return `export const ${componentName} = '${componentName}';`;\n" +
      "}\n",
    );

    await run.run({
      subcommands: ["ts-pattern"],
      flags: [{ flag: "--component-name", value: "Button" }],
    });

    const outputPath = root.append("/.test-output/Button.ts");
    assert(await fs.exists(outputPath)).true();
    assert((await outputPath.text()).trimEnd()).equals("export const Button = 'Button';");

    await mainFolder.remove();
    await outputDir.remove();
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
    });

    const templatePath = patternsFolder.append("/dry-run-test/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    const output = await captureStdout(() => run.run({
      subcommands: ["dry-run-test"],
      flags: [
        { flag: "--dry-run", value: "true" },
        { flag: "--component-name", value: "Button" },
      ],
    }));

    assert(output).includes("=== .test-output/Button.svelte ===");
    assert(output).includes("<button>Button</button>");

    // Verify no file was written
    const outputPath = root.append("/.test-output/Button.svelte");
    assert(await fs.exists(outputPath)).false();

    await mainFolder.remove();
    await outputDir.remove();
  });

test.case("run throws pattern_not_found for missing pattern", async assert => {
  await reset();

  // Create one pattern so .saved/patterns exists
  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "real" }],
  });

  let threw = false;
  try {
    await run.run({
      subcommands: ["nonexistent"],
      flags: [],
    });
  } catch (e) {
    threw = true;
    assert(e instanceof CodeError).true();
    assert((e as CodeError).code).equals("pattern_not_found");
  }
  assert(threw).true();

  await mainFolder.remove();
  await outputDir.remove();
});

test.case("run throws missing_pattern_name with no positional arg",
  async assert => {
    await reset();

    let threw = false;
    try {
      await run.run({
        subcommands: [],
        flags: [],
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("missing_pattern_name");
    }
    assert(threw).true();

    await mainFolder.remove();
    await outputDir.remove();
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
    });

    const templatePath = patternsFolder.append("/needs-vars/button.njk");
    await templatePath.write("<button>{{componentName}} {{theme}}</button>");

    let threw = false;
    try {
      await run.run({
        subcommands: ["needs-vars"],
        flags: [{ flag: "--component-name", value: "Button" }],
        // Missing --theme
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("missing_variable");
      assert((e as Error).message).includes("theme");
    }
    assert(threw).true();

    await mainFolder.remove();
    await outputDir.remove();
  });

test.case("run throws template_not_found when template file is missing",
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
    });

    // Remove the template file
    const templatePath = patternsFolder.append("/missing-tmpl/button.njk");
    await templatePath.remove();

    let threw = false;
    try {
      await run.run({
        subcommands: ["missing-tmpl"],
        flags: [{ flag: "--component-name", value: "Button" }],
      });
    } catch (e) {
      threw = true;
      assert(e instanceof CodeError).true();
      assert((e as CodeError).code).equals("template_not_found");
    }
    assert(threw).true();

    await mainFolder.remove();
    await outputDir.remove();
  });

test.case("run errors without .saved folder", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
  if (await fs.exists(outputDir)) {
    await outputDir.remove();
  }

  let threw = false;
  try {
    await run.run({
      subcommands: ["anything"],
      flags: [],
    });
  } catch {
    threw = true;
  }
  assert(threw).true();
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
    });

    const templatePath = patternsFolder.append("/metrics-test/button.njk");
    await templatePath.write("<button>{{componentName}}</button>");

    await run.run({
      subcommands: ["metrics-test"],
      flags: [{ flag: "--component-name", value: "Button" }],
    });

    const entries = await readMetrics();
    assert(entries.length).equals(1);
    assert(entries[0].pattern).equals("metrics-test");
    assert(entries[0].characters).equals("<button>Button</button>".length);

    await mainFolder.remove();
    await outputDir.remove();
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
  });

  const templatePath = patternsFolder.append("/dry-metrics-test/button.njk");
  await templatePath.write("<button>{{componentName}}</button>");

  await run.run({
    subcommands: ["dry-metrics-test"],
    flags: [
      { flag: "--dry-run", value: "true" },
      { flag: "--component-name", value: "Button" },
    ],
  });

  const entries = await readMetrics();
  assert(entries.length).equals(0);

  await mainFolder.remove();
  await outputDir.remove();
});