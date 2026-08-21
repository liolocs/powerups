import test from "#test-utils/test/index";
import {
  generateModifications,
  type DiffHunk,
  type DiffLine,
} from "#utils/create/capture-files/diff-to-modifications";

function line(type: DiffLine["type"], content: string, noNewline = false): DiffLine {
  return { type, content, noNewline: noNewline || undefined };
}

function hunk(lines: DiffLine[], oldStart = 1, oldCount?: number, newStart = 1, newCount?: number): DiffHunk {
  const removed = lines.filter(l => l.type === "removed").length;
  const added = lines.filter(l => l.type === "added").length;
  const context = lines.filter(l => l.type === "context").length;

  return {
    oldStart,
    oldCount: oldCount ?? context + removed,
    newStart,
    newCount: newCount ?? context + added,
    lines,
  };
}

function applyMods(preImage: string, modifications: unknown[]): string {
  let result = preImage;

  for (const mod of modifications as Array<{ where: string | { after: string } | { before: string }; content: string }>) {
    const where = mod.where;

    if (where === "top") {
      result = mod.content + result;
    } else if (where === "bottom") {
      result = result + mod.content;
    } else if (typeof where === "string") {
      result = result.replace(where, mod.content);
    } else if ("after" in where) {
      const idx = result.indexOf(where.after);
      const pos = idx + where.after.length;
      result = result.slice(0, pos) + mod.content + result.slice(pos);
    } else if ("before" in where) {
      const idx = result.indexOf(where.before);
      result = result.slice(0, idx) + mod.content + result.slice(idx);
    }
  }

  return result;
}

test.case("should generate an insertion modification when lines are added at the top", async assert => {
  const preImage = "line2\nline3\n";
  const postImage = "line1\nline2\nline3\n";
  const hunks = [hunk([
    line("added", "line1"),
    line("context", "line2"),
    line("context", "line3"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  assert(result.modifications[0]!.where).equals("top");
  assert(result.modifications[0]!.content).equals("line1\n");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should generate an insertion modification when lines are added at the bottom", async assert => {
  const preImage = "line1\nline2\n";
  const postImage = "line1\nline2\nline3\n";
  const hunks = [hunk([
    line("context", "line1"),
    line("context", "line2"),
    line("added", "line3"),
  ], 1, 2, 1, 3)];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  assert(result.modifications[0]!.where).equals("bottom");
  assert(result.modifications[0]!.content).equals("line3\n");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should generate a replace modification when lines are changed in place", async assert => {
  const preImage = "const x = 1;\n";
  const postImage = "const x = 2;\n";
  const hunks = [hunk([
    line("removed", "const x = 1;"),
    line("added", "const x = 2;"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  const mod = result.modifications[0]!;
  assert(typeof mod.where).equals("string");
  assert(mod.where).equals("const x = 1;\n");
  assert(mod.content).equals("const x = 2;\n");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should generate a delete modification when lines are removed", async assert => {
  const preImage = "line1\nline2\nline3\n";
  const postImage = "line1\nline3\n";
  const hunks = [hunk([
    line("context", "line1"),
    line("removed", "line2"),
    line("context", "line3"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  const mod = result.modifications[0]!;
  assert(typeof mod.where).equals("string");
  assert(mod.content).equals("");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should handle multiple hunks in a single diff", async assert => {
  const preImage = "line1\nline2\nline3\nline4\nline5\nline6\n";
  const postImage = "line1\nins1\nline2\nline3\nline4\nline5\nins2\nline6\n";
  const hunks = [
    hunk([
      line("context", "line1"),
      line("added", "ins1"),
      line("context", "line2"),
    ], 1, 2, 1, 3),
    hunk([
      line("context", "line5"),
      line("added", "ins2"),
      line("context", "line6"),
    ], 5, 2, 6, 3),
  ];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(2);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should expand context to disambiguate anchors when multiple matches exist", async assert => {
  const preImage = "dup\nfoo\ndup\nbar\n";
  const postImage = "dup\nfoo\ninserted\ndup\nbar\n";
  const hunks = [hunk([
    line("context", "dup"),
    line("context", "foo"),
    line("added", "inserted"),
    line("context", "dup"),
    line("context", "bar"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.warnings.length).equals(0);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("should return a warning for binary file diffs", async assert => {
  const result = generateModifications({
    preImage: "text\0binary\n",
    postImage: "text\n",
    hunks: [hunk([line("removed", "text"), line("added", "text")])],
  });
  assert(result.modifications.length).equals(0);
  assert(result.warnings.length).equals(1);
  assert(result.warnings[0]!.includes("Binary")).true();
});

test.case("should return empty modifications for an empty diff", async assert => {
  const result = generateModifications({
    preImage: "line1\n",
    postImage: "line1\n",
    hunks: [],
  });
  assert(result.modifications.length).equals(0);
  assert(result.warnings.length).equals(1);
});