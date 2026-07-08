import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import error from "@rcompat/error";
import {
  applySingleModification,
  applyMultipleModifications,
  parseModifyTemplate,
} from "#utils/modify-engine";
import { modificationArraySchema } from "#schemas/modification";
import type { CodeError } from "@rcompat/error";
import output_apply_errors from "#errors/outputApplyErrors";

const errors = output_apply_errors["template"];

const root = await runtime.projectRoot();
const testRoot: FileRef = root.append("/tmp");

const t = error.template;

test.case("should prepend content with top", async assert => {
  const result = applySingleModification({
    content: "world",
    mod: { where: "top", content: "hello " },
    outputPath: "out.ts",
    errors,
  });

  assert(result).equals("hello world");
});

test.case("should append content with bottom", async assert => {
  const result = applySingleModification({ content: "hello", mod: { where: "bottom", content: " world" }, outputPath: "out.ts", errors });

  assert(result).equals("hello world");
});

test.case("should replace a unique match with exact string", async assert => {
  const result = applySingleModification({
    content: "export const x = 1;",
    mod: { where: "export const x = 1;", content: "export const x = 2;" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("export const x = 2;");
});

test.case("should insert after an anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    mod: { where: { after: "line1" }, content: "inserted" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("line1inserted\nline2\nline3");
});

test.case("should insert before an anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    mod: { where: { before: "line2" }, content: "inserted\n" },
    outputPath: "out.ts",
    errors,
  });
  assert(result).equals("line1\ninserted\nline2\nline3");
});

test.case("should apply multiple mods in array order sequentially", async assert => {
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

test.case("should parse a .json modify template directly", async assert => {
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

test.case("should render then parse a .njk modify template", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const tmplPath = testRoot.append("/test-mod.njk");
  await tmplPath.write('[{"where":"top","content":"hello {{name}}"}]');

  const result = await parseModifyTemplate(tmplPath, { name: "World" }, errors);

  assert(result.length).equals(1);
  assert(result[0].content).equals("hello World");
  await testRoot.remove();
});

test.case("should apply modifications end-to-end on a real file", async assert => {
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

test.group("modify-engine errors", () => {
  test.case("should throw modify_anchor_not_found when exact string not found", async assert => {
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

  test.case("should throw modify_anchor_ambiguous when exact string appears multiple times", async assert => {
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

  test.case("should throw modify_anchor_not_found when after anchor not found", async assert => {
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

  test.case("should throw modify_anchor_not_found when before anchor not found", async assert => {
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

  test.case("should throw modify_template_invalid_json for invalid JSON output", async assert => {
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
});