import test from "#test-utils/test/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { UseErrorCode } from "#errors/useErrors";
import { modificationArraySchema } from "#schemas/modification";
import {
  applySingleModification,
  applyModifications,
} from "#utils/use/run-powerup/steps/run-modify-step/apply-modifications";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function setupTestDir(): Promise<void> {
  await testRoot.remove();
  await fs.create(testRoot);
}

async function cleanup(): Promise<void> {
  await testRoot.remove();
}

test.case("prepends content with where top", async assert => {
  const result = applySingleModification({
    content: "world",
    modification: { where: "top", content: "hello " },
    outputPath: "out.ts",
  });

  assert(result).equals("hello world");
});

test.case("appends content with where bottom", async assert => {
  const result = applySingleModification({
    content: "hello",
    modification: { where: "bottom", content: " world" },
    outputPath: "out.ts",
  });

  assert(result).equals("hello world");
});

test.case("replaces a unique exact-string match", async assert => {
  const result = applySingleModification({
    content: "export const x = 1;",
    modification: { where: "export const x = 1;", content: "export const x = 2;" },
    outputPath: "out.ts",
  });

  assert(result).equals("export const x = 2;");
});

test.case("inserts content after an anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    modification: { where: { after: "line1" }, content: "inserted" },
    outputPath: "out.ts",
  });

  assert(result).equals("line1inserted\nline2\nline3");
});

test.case("inserts content before an anchor", async assert => {
  const result = applySingleModification({
    content: "line1\nline2\nline3",
    modification: { where: { before: "line2" }, content: "inserted\n" },
    outputPath: "out.ts",
  });

  assert(result).equals("line1\ninserted\nline2\nline3");
});

test.case("applies multiple modifications in array order sequentially", async assert => {
  let content = "line1\nline2\nline3";
  const modifications = modificationArraySchema.parse([
    { where: "top", content: "header" },
    { where: "bottom", content: "footer" },
    { where: { after: "line1" }, content: "inserted" },
  ]);

  for (const modification of modifications) {
    content = applySingleModification({
      content,
      modification,
      outputPath: "out.ts",
    });
  }

  assert(content).equals("headerline1inserted\nline2\nline3footer");
});

test.case("throws modify_anchor_not_found when exact string not found", async assert => {
  try {
    applySingleModification({
      content: "hello world",
      modification: { where: "nonexistent", content: "x" },
      outputPath: "out.ts",
    });
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.modify_anchor_not_found);
  }
});

test.case("throws modify_anchor_ambiguous when exact string appears multiple times", async assert => {
  try {
    applySingleModification({
      content: "foo bar foo",
      modification: { where: "foo", content: "x" },
      outputPath: "out.ts",
    });
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.modify_anchor_ambiguous);
  }
});

test.case("throws modify_anchor_not_found when after anchor not found", async assert => {
  try {
    applySingleModification({
      content: "hello",
      modification: { where: { after: "nonexistent" }, content: "x" },
      outputPath: "out.ts",
    });
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.modify_anchor_not_found);
  }
});

test.case("throws modify_anchor_not_found when before anchor not found", async assert => {
  try {
    applySingleModification({
      content: "hello",
      modification: { where: { before: "nonexistent" }, content: "x" },
      outputPath: "out.ts",
    });
  } catch (error) {
    // @ts-expect-error it doesn't know CodeError so error.code gives a typescript error
    assert(error.code).equals(UseErrorCode.modify_anchor_not_found);
  }
});

test.case("throws modify_target_not_found when target file does not exist", async assert => {
  await setupTestDir();

  const targetPath = testRoot.append("/nonexistent.ts");

  await assert(applyModifications({
    modifications: [],
    outputPath: "nonexistent.ts",
    targetPath,
  })).throwsAsync(UseErrorCode.modify_target_not_found);

  await cleanup();
});