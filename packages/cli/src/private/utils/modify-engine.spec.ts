import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import error from "@rcompat/error";
import {
  applySingleModification,
  applyMultipleModifications,
  parseModifyTemplate,
  type ModifyErrorSet,
} from "#utils/modify-engine";
import { modificationArraySchema } from "#schemas/modification";
import { CodeError } from "@rcompat/error";

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");

const t = error.template;

const errors: ModifyErrorSet = error.coded({
  modify_target_not_found: (path: string) =>
    t`Target file not found: ${path}`,
  modify_anchor_not_found: (anchor: string, path: string) =>
    t`Anchor "${anchor}" not found in: ${path}`,
  modify_anchor_ambiguous: (anchor: string, path: string) =>
    t`Anchor "${anchor}" ambiguous in: ${path}`,
  modify_template_invalid_json: (template: string) =>
    t`Invalid JSON: ${template}`,
});

test.case("applySingleModification with top prepends content", async assert => {
  const result = applySingleModification({ content: "world", mod: { where: "top", content: "hello " }, outputPath: "out.ts", errors });
  assert(result).equals("hello world");
});

test.case("applySingleModification with bottom appends content", async assert => {
  const result = applySingleModification({ content: "hello", mod: { where: "bottom", content: " world" }, outputPath: "out.ts", errors });
  assert(result).equals("hello world");
});

test.case("applySingleModification with exact string replace replaces unique match", async assert => {
  const result = applySingleModification({
    content: "export const x = 1;",
    mod: { where: "export const x = 1;", content: "export const x = 2;" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("export const x = 2;");
});

test.case("applySingleModification with exact string replace when not found throws", async assert => {
  let threw = false;
  try {
    applySingleModification({
      content: "hello world",
      mod: { where: "nonexistent", content: "x" },
      outputPath: "out.ts",
      errors,
    });
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("modify_anchor_not_found");
  }
  assert(threw).true();
});

test.case("applySingleModification with exact string replace when ambiguous throws", async assert => {
  let threw = false;
  try {
    applySingleModification({
      content: "foo bar foo",
      mod: { where: "foo", content: "x" },
      outputPath: "out.ts",
      errors,
    });
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("modify_anchor_ambiguous");
  }
  assert(threw).true();
});

test.case("applySingleModification with after inserts after anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    mod: { where: { after: "line1" }, content: "inserted" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("line1inserted\nline2\nline3");
});

test.case("applySingleModification with after when anchor not found throws", async assert => {
  let threw = false;
  try {
    applySingleModification({
      content: "hello",
      mod: { where: { after: "nonexistent" }, content: "x" },
      outputPath: "out.ts",
      errors,
    });
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("modify_anchor_not_found");
  }
  assert(threw).true();
});

test.case("applySingleModification with before inserts before anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    mod: { where: { before: "line2" }, content: "inserted\n" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("line1\ninserted\nline2\nline3");
});

test.case("applySingleModification with before when anchor not found throws", async assert => {
  let threw = false;
  try {
    applySingleModification({
      content: "hello",
      mod: { where: { before: "nonexistent" }, content: "x" },
      outputPath: "out.ts",
      errors,
    });
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("modify_anchor_not_found");
  }
  assert(threw).true();
});

test.case("sequential application: multiple mods in array order", async assert => {
  let content = "line1\nline2\nline3";
  const mods = modificationArraySchema.parse([
    { where: "top", content: "header" },
    { where: "bottom", content: "footer" },
    { where: { after: "line1" }, content: "inserted" },
  ]);

  for (const mod of mods) {
    content = applySingleModification({ content, mod, outputPath: "out.ts", errors });
  }

  assert(content).equals("headerline1inserted\nline2\nline3footer");
});

test.case("parseModifyTemplate with .json file parses directly", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const tmplPath = testRoot.append("/test-mod.json");
  await tmplPath.write('[{"where":"top","content":"hello"}]');

  const result = await parseModifyTemplate(tmplPath, {}, errors);

  assert(result.length).equals(1);
  assert(result[0].where).equals("top");
  assert(result[0].content).equals("hello");
  await testRoot.remove();
});

test.case("parseModifyTemplate with .njk file renders then parses", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const tmplPath = testRoot.append("/test-mod.njk");
  await tmplPath.write('[{"where":"top","content":"hello {{name}}"}]');

  const result = await parseModifyTemplate(tmplPath, { name: "World" }, errors);

  assert(result.length).equals(1);
  assert(result[0].content).equals("hello World");
  await testRoot.remove();
});

test.case("parseModifyTemplate with invalid JSON throws", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const tmplPath = testRoot.append("/bad-mod.json");
  await tmplPath.write("{not valid json}");

  let threw = false;
  try {
    await parseModifyTemplate(tmplPath, {}, errors);
  } catch (e) {
    threw = true;
    assert((e as CodeError).code).equals("modify_template_invalid_json");
  }
  assert(threw).true();
  await testRoot.remove();
});

test.case("applyMultipleModifications end-to-end with a real file", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  // Create target file
  const targetPath = testRoot.append("/target.ts");
  await targetPath.write("line1\nline2\nline3\n");

  // Create modify template
  const tmplPath = testRoot.append("/mod.json");
  await tmplPath.write('[{"where":"top","content":"// header\\n"},{"where":{"after":"line1"},"content":"inserted"}]');

  const result = await applyMultipleModifications({
    task: {
      templatePath: tmplPath,
      outputPath: "target.ts",
      variables: {},
    },
    rootDir: testRoot,
    errors,
  });

  assert(result.content).equals("// header\nline1inserted\nline2\nline3\n");
  await testRoot.remove();
});