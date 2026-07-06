import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import validate from "#commands/pattern/validate";
import generate from "#commands/pattern/generate";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const patternsFolder: FileRef = mainFolder.append(`/${PATTERNS_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

async function patternPath(name: string): Promise<FileRef> {
  return patternsFolder.append(`/${name}/instructions.json`);
}

test.case("validate reports all valid when every pattern conforms",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--intent", value: "ui,component" },
      { flag: "--output", value: JSON.stringify({
        files: [{
          name: "button.svelte",
          template: "button.svelte.tmpl",
          outputPath: "src/{{ComponentName}}.svelte",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "api-route" }],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("Validated 2 pattern(s)");
  assert(output).includes("All valid");

  await testRoot.remove();
});

test.case("validate --name reports a single valid pattern", async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "ui-component" }],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => validate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "ui-component" }],
    context: { root: testRoot },
  }));

  assert(output).includes("ui-component is valid");

  await testRoot.remove();
});

test.case("validate reports a schema violation across all patterns",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "bad-schema" }],
    context: { root: testRoot },
  });

  // Corrupt: name must be a string.
  const path = await patternPath("bad-schema");
  await path.writeJSON({ name: 123 });

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("bad-schema");
  assert(output).includes(".name");

  await testRoot.remove();
});

test.case("validate reports a missing template across all patterns",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "missing-template" },
      { flag: "--output", value: JSON.stringify({
        files: [{
          name: "button.svelte",
          template: "button.svelte.tmpl",
          outputPath: "src/{{ComponentName}}.svelte",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  // Remove the template file that generate created.
  const templatePath = patternsFolder.append(
    "/missing-template/button.svelte.tmpl",
  );
  await templatePath.remove();

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("missing-template");
  assert(output).includes("missing template file: button.svelte.tmpl");

  await testRoot.remove();
});

test.case("validate --name throws invalid_pattern for a missing template",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "missing-template" },
      { flag: "--output", value: JSON.stringify({
        files: [{
          name: "button.svelte",
          template: "button.svelte.tmpl",
          outputPath: "src/{{ComponentName}}.svelte",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  const templatePath = patternsFolder.append(
    "/missing-template/button.svelte.tmpl",
  );
  await templatePath.remove();

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "missing-template" }],
      context: { root: testRoot },
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("invalid_pattern");
  assert((error as Error).message).includes("button.svelte.tmpl");

  await testRoot.remove();
});

test.case("validate reports multiple missing templates in one pass",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "many-missing" },
      { flag: "--output", value: JSON.stringify({
        files: [
          { name: "a", template: "a.tmpl", outputPath: "a" },
          { name: "b", template: "b.tmpl", outputPath: "b" },
        ],
      }) },
    ],
    context: { root: testRoot },
  });

  await patternsFolder.append("/many-missing/a.tmpl").remove();
  await patternsFolder.append("/many-missing/b.tmpl").remove();

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(error instanceof CodeError).true();
  assert(output).includes("missing template file: a.tmpl");
  assert(output).includes("missing template file: b.tmpl");

  await testRoot.remove();
});

test.case("validate --name throws pattern_not_found for a missing pattern",
  async assert => {
  await reset();

  // Create one real pattern so the patterns folder exists, then target a
  // nonexistent name.
  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "real-pattern" }],
    context: { root: testRoot },
  });

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "nope" }],
      context: { root: testRoot },
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("pattern_not_found");

  await testRoot.remove();
});

test.case("validate throws no_patterns_found without a patterns folder",
  async assert => {
  await reset();

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("no_patterns_found");

  await testRoot.remove();
});

test.case("validate errors without .saved folder", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  let threw = false;
  try {
    await validate.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("validate reports missing subpattern in includes", async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "parent" },
      { flag: "--output", value: JSON.stringify({
        files: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
      }) },
    ],
    context: { root: testRoot },
  });

  // Manually add includes referencing a nonexistent subpattern
  const path = await patternPath("parent");
  await path.writeJSON({
    name: "parent",
    variables: [],
    intent: [],
    output: {
      files: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
    },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("parent");
  assert(output).includes("subpattern not found: nonexistent");

  await testRoot.remove();
});

test.case("validate reports circular reference in includes", async assert => {
  await reset();

  // Create two patterns that reference each other
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

  await (await patternPath("cycle-a")).writeJSON({
    name: "cycle-a",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "cycle-b", variables: {} }],
  });
  await (await patternPath("cycle-b")).writeJSON({
    name: "cycle-b",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "cycle-a", variables: {} }],
  });

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("circular reference");

  await testRoot.remove();
});

test.case("validate --name reports invalid composition for a single pattern", async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "bad-parent" }],
    context: { root: testRoot },
  });

  await (await patternPath("bad-parent")).writeJSON({
    name: "bad-parent",
    variables: [],
    intent: [],
    output: { files: [] },
    includes: [{ name: "nonexistent", variables: {} }],
  });

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "bad-parent" }],
      context: { root: testRoot },
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("invalid_pattern");
  assert((error as Error).message).includes("subpattern not found: nonexistent");

  await testRoot.remove();
});

test.case("validate passes valid composite pattern", async assert => {
  await reset();

  // Create a valid child pattern
  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "valid-child" },
      { flag: "--variables", value: "componentName" },
      { flag: "--output", value: JSON.stringify({
        files: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
      }) },
    ],
    context: { root: testRoot },
  });
  // Write the child template
  await patternsFolder.append("/valid-child/c.njk").write("test");

  // Create a valid parent pattern
  await generate.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "valid-parent" },
      { flag: "--variables", value: "theme" },
      { flag: "--output", value: JSON.stringify({
        files: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
      }) },
    ],
    context: { root: testRoot },
  });
  // Write the parent template
  await patternsFolder.append("/valid-parent/b.njk").write("test");

  // Add includes to the parent
  await (await patternPath("valid-parent")).writeJSON({
    name: "valid-parent",
    variables: ["theme"],
    intent: [],
    output: {
      files: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
    },
    includes: [
      {
        name: "valid-child",
        variables: { componentName: "Button", theme: "{{theme}}" },
      },
    ],
  });

  const output = await captureStdout(() => validate.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("Validated 2 pattern(s)");
  assert(output).includes("All valid");

  await testRoot.remove();
});