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
const mainFolder: FileRef = root.append(`/${MAIN_FOLDER}`);
const patternsFolder: FileRef = mainFolder.append(`/${PATTERNS_FOLDER}`);

async function reset() {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }
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
  });

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "api-route" }],
  });

  const output = await captureStdout(() => validate.run({
    subcommands: [],
    flags: [],
  }));

  assert(output).includes("Validated 2 pattern(s)");
  assert(output).includes("All valid");

  await mainFolder.remove();
});

test.case("validate --name reports a single valid pattern", async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "ui-component" }],
  });

  const output = await captureStdout(() => validate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "ui-component" }],
  }));

  assert(output).includes("ui-component is valid");

  await mainFolder.remove();
});

test.case("validate reports a schema violation across all patterns",
  async assert => {
  await reset();

  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "bad-schema" }],
  });

  // Corrupt: name must be a string.
  const path = await patternPath("bad-schema");
  await path.writeJSON({ name: 123 });

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("bad-schema");
  assert(output).includes(".name");

  await mainFolder.remove();
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
  });

  // Remove the template file that generate created.
  const templatePath = patternsFolder.append(
    "/missing-template/button.svelte.tmpl",
  );
  await templatePath.remove();

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
  }));

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("validation_failed");
  assert(output).includes("missing-template");
  assert(output).includes("missing template file: button.svelte.tmpl");

  await mainFolder.remove();
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
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("invalid_pattern");
  assert((error as Error).message).includes("button.svelte.tmpl");

  await mainFolder.remove();
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
  });

  await patternsFolder.append("/many-missing/a.tmpl").remove();
  await patternsFolder.append("/many-missing/b.tmpl").remove();

  const { output, error } = await captureStdoutOrError(() => validate.run({
    subcommands: [],
    flags: [],
  }));

  assert(error instanceof CodeError).true();
  assert(output).includes("missing template file: a.tmpl");
  assert(output).includes("missing template file: b.tmpl");

  await mainFolder.remove();
});

test.case("validate --name throws pattern_not_found for a missing pattern",
  async assert => {
  await reset();

  // Create one real pattern so the patterns folder exists, then target a
  // nonexistent name.
  await generate.run({
    subcommands: [],
    flags: [{ flag: "--name", value: "real-pattern" }],
  });

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "nope" }],
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("pattern_not_found");

  await mainFolder.remove();
});

test.case("validate throws no_patterns_found without a patterns folder",
  async assert => {
  await reset();

  let error: unknown;
  try {
    await validate.run({
      subcommands: [],
      flags: [],
    });
  } catch (error_) {
    error = error_;
  }

  assert(error instanceof CodeError).true();
  assert((error as CodeError).code).equals("no_patterns_found");

  await mainFolder.remove();
});

test.case("validate errors without .saved folder", async assert => {
  if (await fs.exists(mainFolder)) {
    await mainFolder.remove();
  }

  let threw = false;
  try {
    await validate.run({
      subcommands: [],
      flags: [],
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);
});