import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import createInfoCommand from "#commands/output/info/index";
import createCreateCommand from "#commands/output/create/index";
import captureStdout from "#test-utils/capture-stdout";
import { CodeError } from "@rcompat/error";
import { OutputTemplateInfoErrorCode } from "#errors/outputInfoErrors";
import { CLI_CMD, MAIN_FOLDER } from "#constants";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");
const mainFolder: FileRef = testRoot.append(`/${MAIN_FOLDER}`);

const infoCmd = createInfoCommand("template");
const createCmd = createCreateCommand("template");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(mainFolder);
}

test.case("info prints name, description, intent, and usage", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "ui-component" },
      { flag: "--description", value: "A UI component template" },
      { flag: "--intent", value: "ui,component" },
      { flag: "--variables", value: "ComponentName" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["ui-component"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("# ui-component");
  assert(output).includes("A UI component template");
  assert(output).includes("## Intent");
  assert(output).includes("ui, component");
  assert(output).includes("## Usage");
  assert(output).includes(`${CLI_CMD} template apply ui-component --component-name=<value>`);

  await testRoot.remove();
});

test.case("info prints required and optional variables", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "api-route" },
      { flag: "--description", value: "An API route template" },
      { flag: "--variables", value: "name,method" },
      { flag: "--optional-variables", value: "middleware" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["api-route"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Variables");
  assert(output).includes("### Required");
  assert(output).includes("`--name=<value>`");
  assert(output).includes("`--method=<value>`");
  assert(output).includes("### Optional");
  assert(output).includes("`--middleware=<value>`");
  assert(output).includes("[--middleware=<value>]");

  await testRoot.remove();
});

test.case("info prints create, modify, and delete files", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "full-output" },
      { flag: "--description", value: "A template with all file types" },
      { flag: "--variables", value: "ComponentName" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "component",
          template: "component.njk",
          outputPath: "src/{{ComponentName}}.tsx",
        }],
        modify: [{
          name: "index",
          template: "index.json",
          outputPath: "src/index.ts",
        }],
        delete: [{
          name: "old-file",
          outputPath: "src/legacy.ts",
        }],
      }) },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["full-output"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Files");
  assert(output).includes("### Create");
  assert(output).includes("`src/{{ComponentName}}.tsx` (template: `component.njk`)");
  assert(output).includes("### Modify");
  assert(output).includes("`src/index.ts` (template: `index.json`)");
  assert(output).includes("### Delete");
  assert(output).includes("`src/legacy.ts`");

  await testRoot.remove();
});

test.case("info prints package dependencies", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "add-tailwind" },
      { flag: "--description", value: "Adds tailwind to a project" },
      { flag: "--variables", value: "name" },
      { flag: "--package-deps", value: JSON.stringify([
        {
          target: "packages/web",
          dependencies: ["tailwindcss@^4.0.0"],
          devDependencies: ["@types/tailwindcss@^3.0.0"],
        },
      ]) },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["add-tailwind"],
    flags: [],
    context: { root: testRoot },
  }));

  assert(output).includes("## Dependencies");
  assert(output).includes("tailwindcss@^4.0.0 (target: packages/web)");
  assert(output).includes("@types/tailwindcss@^3.0.0 (devDependency, target: packages/web)");

  await testRoot.remove();
});

test.case("info prints includes with variable bindings for composite templates", async assert => {
  await reset();

  // Create child template
  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "child-component" },
      { flag: "--description", value: "A child component template" },
      { flag: "--variables", value: "componentName,theme" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "comp",
          template: "comp.njk",
          outputPath: "src/ui/{{componentName}}.tsx",
        }],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  // Create parent template with includes
  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "parent-composite" },
      { flag: "--description", value: "A composite template" },
      { flag: "--variables", value: "theme" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "barrel",
          template: "barrel.njk",
          outputPath: "src/index.ts",
        }],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  // Overwrite parent instructions.json to add includes
  const templateFolder = testRoot.append(`/${MAIN_FOLDER}/output/template`);
  const parentInstructionsPath = templateFolder.append("/parent-composite/instructions.json");
  await parentInstructionsPath.writeJSON({
    name: "parent-composite",
    description: "A composite template",
    variables: { required: ["theme"] },
    intent: [],
    output: {
      create: [{ name: "barrel", template: "barrel.njk", outputPath: "src/index.ts" }],
      modify: [],
    },
    includes: [
      {
        name: "child-component",
        variables: { componentName: "Button", theme: "{{theme}}" },
      },
    ],
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["parent-composite"],
    flags: [],
    context: { root: testRoot },
  }));

  // Includes section
  assert(output).includes("## Includes");
  assert(output).includes("**child-component**");
  assert(output).includes("A child component template");
  assert(output).includes("componentName");
  assert(output).includes("Button");
  assert(output).includes("(literal)");
  assert(output).includes("{{theme}}");
  assert(output).includes("(from parent)");

  // Files from child are listed with from include annotation
  assert(output).includes("`src/ui/{{componentName}}.tsx` (template: `comp.njk`, from include: child-component)");

  // Usage only shows parent's required variables
  assert(output).includes(`${CLI_CMD} template apply parent-composite --theme=<value>`);

  await testRoot.remove();
});

test.case("info applies outputPathOverride from includes in file listing", async assert => {
  await reset();

  // Create child template with a create file named "comp"
  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "override-child" },
      { flag: "--description", value: "A child with overrideable paths" },
      { flag: "--variables", value: "componentName" },
      { flag: "--output", value: JSON.stringify({
        create: [{
          name: "comp",
          template: "comp.njk",
          outputPath: "src/original/{{componentName}}.tsx",
        }],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  // Create parent template with includes that override the child's outputPath
  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "override-parent" },
      { flag: "--description", value: "A parent with outputPathOverride" },
      { flag: "--variables", value: "theme" },
      { flag: "--output", value: JSON.stringify({
        create: [],
        modify: [],
      }) },
    ],
    context: { root: testRoot },
  });

  const templateFolder = testRoot.append(`/${MAIN_FOLDER}/output/template`);
  const parentInstructionsPath = templateFolder.append("/override-parent/instructions.json");
  await parentInstructionsPath.writeJSON({
    name: "override-parent",
    description: "A parent with outputPathOverride",
    variables: { required: ["theme"] },
    intent: [],
    output: { create: [], modify: [] },
    includes: [
      {
        name: "override-child",
        variables: { componentName: "Button", theme: "{{theme}}" },
        outputPathOverride: {
          create: { comp: "src/ui/overridden/{{componentName}}.tsx" },
        },
      },
    ],
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["override-parent"],
    flags: [],
    context: { root: testRoot },
  }));

  // The overridden path should appear, not the original
  assert(output).includes("src/ui/overridden/{{componentName}}.tsx");
  // The original path should NOT appear
  assert(output.includes("src/original/")).false();

  await testRoot.remove();
});

test.case("info omits empty sections when template has no files, deps, or includes", async assert => {
  await reset();

  await createCmd.run({
    subcommands: [],
    flags: [
      { flag: "--name", value: "simple-template" },
      { flag: "--description", value: "A simple template" },
      { flag: "--variables", value: "name" },
    ],
    context: { root: testRoot },
  });

  const output = await captureStdout(() => infoCmd.run({
    subcommands: ["simple-template"],
    flags: [],
    context: { root: testRoot },
  }));

  // These sections should NOT appear since the template has no output files,
  // no dependencies, no includes, and no optional variables.
  assert(output.includes("## Files")).false();
  assert(output.includes("## Dependencies")).false();
  assert(output.includes("## Includes")).false();
  assert(output.includes("### Optional")).false();

  await testRoot.remove();
});

test.group("info errors", () => {
  test.case("should fail with missing_name when no name provided", async assert => {
    await reset();

    let threw;
    try {
      await infoCmd.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateInfoErrorCode.missing_name);

    await testRoot.remove();
  });

  test.case("should fail with not_found for a nonexistent template", async assert => {
    await reset();

    let threw;
    try {
      await infoCmd.run({
        subcommands: ["nonexistent"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateInfoErrorCode.not_found);

    await testRoot.remove();
  });

  test.case(`should fail with dry_folder_not_found without ${MAIN_FOLDER}} folder`, async assert => {
    await testRoot.remove();
    await fs.create(testRoot);

    let threw;
    try {
      await infoCmd.run({
        subcommands: ["some-template"],
        flags: [],
        context: { root: testRoot },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(OutputTemplateInfoErrorCode.dry_folder_not_found);

    await testRoot.remove();
  });
});