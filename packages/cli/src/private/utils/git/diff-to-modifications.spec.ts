import test from "@rcompat/test";
import {
  generateModifications,
  type DiffHunk,
  type DiffLine,
} from "#utils/git/diff-to-modifications";
import { modificationArraySchema } from "#schemas/modification";

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

test.case("insertion at file start uses top anchor", async assert => {
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

test.case("insertion at file end uses bottom anchor", async assert => {
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

test.case("insertion after unique context line uses after anchor", async assert => {
  const preImage = "import { foo } from \"foo\";\n\nconst x = 1;\n";
  const postImage = "import { foo } from \"foo\";\nimport { bar } from \"bar\";\n\nconst x = 1;\n";
  const hunks = [hunk([
    line("context", "import { foo } from \"foo\";"),
    line("added", "import { bar } from \"bar\";"),
    line("context", ""),
    line("context", "const x = 1;"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  const mod = result.modifications[0]!;
  assert(typeof mod.where).equals("object");
  assert("after" in (mod.where as Record<string, unknown>)).true();
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("insertion before unique context line uses before anchor when after is ambiguous", async assert => {
  const preImage = "dup\nmiddle\ndup\nconst y = 2;\n";
  const postImage = "dup\nmiddle\ndup\nconst z = 0;\nconst y = 2;\n";
  const hunks = [hunk([
    line("context", "dup"),
    line("added", "const z = 0;"),
    line("context", "const y = 2;"),
  ], 3, 2, 3, 3)];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.warnings.length).equals(0);
  const mod = result.modifications[0]!;
  assert(typeof mod.where).equals("object");
  assert("before" in (mod.where as Record<string, unknown>)).true();
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("deletion of unique line uses exact replacement with empty content", async assert => {
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

test.case("replacement of unique line uses exact replacement", async assert => {
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

test.case("multi-line contiguous insertion produces single entry", async assert => {
  const preImage = "line1\nline4\n";
  const postImage = "line1\nline2\nline3\nline4\n";
  const hunks = [hunk([
    line("context", "line1"),
    line("added", "line2"),
    line("added", "line3"),
    line("context", "line4"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.modifications[0]!.content).equals("line2\nline3\n");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("multi-line contiguous replacement produces single entry", async assert => {
  const preImage = "const old1 = 1;\nconst old2 = 2;\n";
  const postImage = "const new1 = 1;\nconst new2 = 2;\n";
  const hunks = [hunk([
    line("removed", "const old1 = 1;"),
    line("removed", "const old2 = 2;"),
    line("added", "const new1 = 1;"),
    line("added", "const new2 = 2;"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  const mod = result.modifications[0]!;
  assert(typeof mod.where).equals("string");
  assert(mod.where).equals("const old1 = 1;\nconst old2 = 2;\n");
  assert(mod.content).equals("const new1 = 1;\nconst new2 = 2;\n");
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("ambiguous anchor with duplicated context line expands to unique context", async assert => {
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

test.case("round-trip: insertions only", async assert => {
  const preImage = "a\nb\nc\n";
  const postImage = "a\nx\nb\nc\ny\n";
  const hunks = [
    hunk([
      line("context", "a"),
      line("added", "x"),
      line("context", "b"),
      line("context", "c"),
    ]),
    hunk([
      line("added", "y"),
    ], 3, 1, 4, 2),
  ];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("round-trip: deletions only", async assert => {
  const preImage = "a\nb\nc\nd\n";
  const postImage = "a\nc\n";
  const hunks = [hunk([
    line("context", "a"),
    line("removed", "b"),
    line("context", "c"),
    line("removed", "d"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("round-trip: mixed insertions, deletions, and replacements", async assert => {
  const preImage = "import { a } from \"a\";\nconst old = 1;\nconst keep = 2;\nconst del = 3;\n";
  const postImage = "import { a } from \"a\";\nimport { b } from \"b\";\nconst new = 1;\nconst keep = 2;\n";
  const hunks = [hunk([
    line("context", "import { a } from \"a\";"),
    line("added", "import { b } from \"b\";"),
    line("removed", "const old = 1;"),
    line("added", "const new = 1;"),
    line("context", "const keep = 2;"),
    line("removed", "const del = 3;"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("multiple edits in one hunk produce separate entries", async assert => {
  const preImage = "a\nb\nc\nd\n";
  const postImage = "a\nx\nb\nc\ny\nd\n";
  const hunks = [hunk([
    line("context", "a"),
    line("added", "x"),
    line("context", "b"),
    line("context", "c"),
    line("added", "y"),
    line("context", "d"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(2);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("multiple hunks produce separate entries", async assert => {
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

test.case("empty diff returns warning and no modifications", async assert => {
  const result = generateModifications({
    preImage: "line1\n",
    postImage: "line1\n",
    hunks: [],
  });
  assert(result.modifications.length).equals(0);
  assert(result.warnings.length).equals(1);
});

test.case("binary file returns warning and no modifications", async assert => {
  const result = generateModifications({
    preImage: "text\0binary\n",
    postImage: "text\n",
    hunks: [hunk([line("removed", "text"), line("added", "text")])],
  });
  assert(result.modifications.length).equals(0);
  assert(result.warnings.length).equals(1);
  assert(result.warnings[0]!.includes("Binary")).true();
});

test.case("identical pre and post image returns no modifications", async assert => {
  const result = generateModifications({
    preImage: "same\n",
    postImage: "same\n",
    hunks: [hunk([line("context", "same")])],
  });
  assert(result.modifications.length).equals(0);
  assert(result.warnings.length).equals(0);
});

test.case("generated modifications are valid against modification schema", async assert => {
  const preImage = "const x = 1;\n";
  const postImage = "const x = 2;\n";
  const hunks = [hunk([
    line("removed", "const x = 1;"),
    line("added", "const x = 2;"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  modificationArraySchema.parse(result.modifications);
});

test.case("two identical replacements in one hunk resolved by preImage expansion", async assert => {
  const preImage = "root {\n  unique-a: 1;\n  font\n  dup: 10\n  shadow\n}\ndark {\n  unique-b: 2;\n  font\n  dup: 10\n  shadow\n}\n";
  const postImage = "root {\n  unique-a: 1;\n  font\n  dup: 20\n  shadow\n}\ndark {\n  unique-b: 2;\n  font\n  dup: 20\n  shadow\n}\n";
  const hunks = [hunk([
    line("context", "root {"),
    line("context", "  unique-a: 1;"),
    line("context", "  font"),
    line("removed", "  dup: 10"),
    line("added", "  dup: 20"),
    line("context", "  shadow"),
    line("context", "}"),
    line("context", "dark {"),
    line("context", "  unique-b: 2;"),
    line("context", "  font"),
    line("removed", "  dup: 10"),
    line("added", "  dup: 20"),
    line("context", "  shadow"),
    line("context", "}"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(2);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("trailing newline removal", async assert => {
  const preImage = "line1\nline2\n}\n";
  const postImage = "line1\nline2\n}";
  const hunks = [hunk([
    line("context", "line1"),
    line("context", "line2"),
    line("removed", "}", false),
    line("added", "}", true),
  ], 1, 3, 1, 3)];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("trailing newline addition", async assert => {
  const preImage = "line1\nline2\n}";
  const postImage = "line1\nline2\n}\n";
  const hunks = [hunk([
    line("context", "line1"),
    line("context", "line2"),
    line("removed", "}", true),
    line("added", "}", false),
  ], 1, 3, 1, 3)];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("content changes plus trailing newline removal in separate hunks", async assert => {
  const preImage = "{\n  \"paths\": {\n    \"old\": 1\n  }\n}\n";
  const postImage = "{\n  \"paths\": {\n    \"old\": 1\n    \"new\": 2\n  }\n}";
  const hunks = [
    hunk([
      line("context", "  \"paths\": {"),
      line("context", "    \"old\": 1"),
      line("added", "    \"new\": 2"),
      line("context", "  }"),
    ], 2, 3, 2, 4),
    hunk([
      line("removed", "}", false),
      line("added", "}", true),
    ], 5, 1, 6, 1),
  ];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});

test.case("fallback keeps applicable mod when other mod has unresolvable anchor", async assert => {
  // Two identical lines, both changed to different values in separate hunks.
  // Both mods expand to where="a\na\n" (unique in preImage), but after mod 0
  // is applied, mod 1's anchor no longer exists — fallback skips it.
  const preImage = "a\na\n";
  const postImage = "b\nc\n";
  const hunks = [
    hunk([
      line("removed", "a"),
      line("added", "b"),
    ], 1, 1, 1, 1),
    hunk([
      line("removed", "a"),
      line("added", "c"),
    ], 2, 1, 2, 1),
  ];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(result.modifications[0]!.where).equals("a\na\n");
  assert(result.warnings.length > 0).true();
});

test.case("insertion with ambiguous context resolved by preImage expansion", async assert => {
  const preImage = ":root {\n  unique: 1;\n  dup\n  shadow\n}\n.dark {\n  other: 2;\n  dup\n  shadow\n}\n";
  const postImage = ":root {\n  unique: 1;\n  dup\n  INSERTED\n  shadow\n}\n.dark {\n  other: 2;\n  dup\n  shadow\n}\n";
  const hunks = [hunk([
    line("context", ":root {"),
    line("context", "  unique: 1;"),
    line("context", "  dup"),
    line("added", "  INSERTED"),
    line("context", "  shadow"),
    line("context", "}"),
  ])];

  const result = generateModifications({ preImage, postImage, hunks });
  assert(result.modifications.length).equals(1);
  assert(applyMods(preImage, result.modifications)).equals(postImage);
});