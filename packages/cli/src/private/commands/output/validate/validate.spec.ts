import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { CodeError } from "@rcompat/error";
import createValidateCommand from "#commands/output/validate/index";
import createCreateCommand from "#commands/output/create/index";
import { OutputTemplateCreateErrorCode } from "#errors/outputCreateErrors";
import captureStdout, {
  captureStdoutOrError,
} from "#test-utils/capture-stdout";
import { MAIN_FOLDER, OUTPUT_FOLDER, TEMPLATE_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);
const templateFolder: FileRef = mainFolder.append(`/${OUTPUT_FOLDER}/${TEMPLATE_FOLDER}`);

const validate = createValidateCommand("template");
const createCmd = createCreateCommand("template");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

async function outputPath(name: string): Promise<FileRef> {
  return templateFolder.append(`/${name}/instructions.json`);
}

test.case("validate --name reports a single valid template", async assert => {
  await reset();

  await createCmd.run({
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

test.group("validate errors", () => {
  test.case("should fail with dry_folder_not_found without .saved folder", async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await validate.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateCreateErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });

  test.case("should fail with no_outputs_found without a templates folder", async assert => {
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
    assert((error as CodeError).code).equals("no_outputs_found");

    await testRoot.remove();
  });

  test.case("should fail with not_found for a missing template name", async assert => {
    await reset();

    // Create one real template so the templates folder exists, then target a
    // nonexistent name.
    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "real-template" }],
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
    assert((error as CodeError).code).equals("not_found");

    await testRoot.remove();
  });

  test.case("should fail with invalid for a missing template file", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "missing-template" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    const templatePath = templateFolder.append(
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
    assert((error as CodeError).code).equals("invalid");
    assert((error as Error).message).includes("button.svelte.tmpl");

    await testRoot.remove();
  });

  test.case("should fail with invalid for invalid composition in a single template", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "bad-parent" }],
      context: { root: testRoot },
    });

    await (await outputPath("bad-parent")).writeJSON({
      name: "bad-parent",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
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
    assert((error as CodeError).code).equals("invalid");
    assert((error as Error).message).includes("suboutput not found: nonexistent");

    await testRoot.remove();
  });
});

test.group("validate all-targets", () => {
  test.case("should report all valid when every template conforms",
    async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "ui-component" },
        { flag: "--intent", value: "ui,component" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "api-route" }],
      context: { root: testRoot },
    });

    const output = await captureStdout(() => validate.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot },
    }));

    assert(output).includes("Validated 2 template(s)");
    assert(output).includes("All valid");

    await testRoot.remove();
  });

  test.case("should report a schema violation across all templates",
    async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "bad-schema" }],
      context: { root: testRoot },
    });

    // Corrupt: name must be a string.
    const path = await outputPath("bad-schema");
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

  test.case("should report a missing template across all templates",
    async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "missing-template" },
        { flag: "--output", value: JSON.stringify({
          create: [{
            name: "button.svelte",
            template: "button.svelte.tmpl",
            outputPath: "src/{{ComponentName}}.svelte",
          }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    // Remove the template file that create created.
    const templatePath = templateFolder.append(
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

  test.case("should report multiple missing templates in one pass",
    async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "many-missing" },
        { flag: "--output", value: JSON.stringify({
          create: [
            { name: "a", template: "a.tmpl", outputPath: "a" },
            { name: "b", template: "b.tmpl", outputPath: "b" },
          ],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    await templateFolder.append("/many-missing/a.tmpl").remove();
    await templateFolder.append("/many-missing/b.tmpl").remove();

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
});

test.group("validate composite", () => {
  test.case("should report missing suboutput in includes", async assert => {
    await reset();

    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "parent" },
        { flag: "--output", value: JSON.stringify({
          create: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });

    // Manually add includes referencing a nonexistent suboutput
    const path = await outputPath("parent");
    await path.writeJSON({
      name: "parent",
      variables: { required: [] },
      intent: [],
      output: {
        create: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
        modify: [],
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
    assert(output).includes("suboutput not found: nonexistent");

    await testRoot.remove();
  });

  test.case("should report circular reference in includes", async assert => {
    await reset();

    // Create two templates that reference each other
    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "cycle-a" }],
      context: { root: testRoot },
    });
    await createCmd.run({
      subcommands: [],
      flags: [{ flag: "--name", value: "cycle-b" }],
      context: { root: testRoot },
    });

    await (await outputPath("cycle-a")).writeJSON({
      name: "cycle-a",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
      includes: [{ name: "cycle-b", variables: {} }],
    });
    await (await outputPath("cycle-b")).writeJSON({
      name: "cycle-b",
      variables: { required: [] },
      intent: [],
      output: { create: [], modify: [] },
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

  test.case("should pass a valid composite template", async assert => {
    await reset();

    // Create a valid child template
    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "valid-child" },
        { flag: "--variables", value: "componentName" },
        { flag: "--output", value: JSON.stringify({
          create: [{ name: "comp", template: "c.njk", outputPath: "src/{{componentName}}.tsx" }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });
    // Write the child template
    await templateFolder.append("/valid-child/c.njk").write("test");

    // Create a valid parent template
    await createCmd.run({
      subcommands: [],
      flags: [
        { flag: "--name", value: "valid-parent" },
        { flag: "--variables", value: "theme" },
        { flag: "--output", value: JSON.stringify({
          create: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
          modify: [],
        }) },
      ],
      context: { root: testRoot },
    });
    // Write the parent template
    await templateFolder.append("/valid-parent/b.njk").write("test");

    // Add includes to the parent
    await (await outputPath("valid-parent")).writeJSON({
      name: "valid-parent",
      variables: { required: ["theme"] },
      intent: [],
      output: {
        create: [{ name: "barrel", template: "b.njk", outputPath: "src/index.ts" }],
        modify: [],
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

    assert(output).includes("Validated 2 template(s)");
    assert(output).includes("All valid");

    await testRoot.remove();
  });
});