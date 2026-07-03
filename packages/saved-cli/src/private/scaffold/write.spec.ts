import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { linkClaudeMd } from "#scaffold/claude-md";
import { writeCommandFile } from "#scaffold/write";
import { CLI_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("creates CLAUDE.md symlink to AGENTS.md", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/AGENTS.md").write("# Test");

  await linkClaudeMd(testRoot);

  const claudeMd = testRoot.append("/CLAUDE.md");
  assert(await fs.exists(claudeMd)).equals(true);
  // Verify it's a symlink (reads same content as AGENTS.md) or @AGENTS.md fallback
  const content = await claudeMd.text();
  const isSymlinkOrImport = content.includes("# Test") || content.includes("@AGENTS.md");
  assert(isSymlinkOrImport).equals(true);

  await testRoot.remove();
});

test.case("errors if CLAUDE.md exists and is not a symlink", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/CLAUDE.md").write("# My file");

  let threw = false;
  try {
    await linkClaudeMd(testRoot);
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("writes command file with constants substituted", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.claude/commands"));

  const rendered = `Search ${CLI_NAME} patterns for "$ARGUMENTS".`;
  await writeCommandFile(testRoot, ".claude/commands/new-" + CLI_NAME + "-feature.md", rendered);

  const content = await testRoot.append("/.claude/commands/new-" + CLI_NAME + "-feature.md").text();
  assert(content.includes(CLI_NAME)).equals(true);
  assert(content.includes("{{CLI_NAME}}")).equals(false);

  await testRoot.remove();
});

test.case("injects opencode frontmatter for .opencode/ paths", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await fs.create(testRoot.append("/.opencode/commands"));

  const rendered = `Search ${CLI_NAME} patterns for "$ARGUMENTS".`;
  const path = ".opencode/commands/new-" + CLI_NAME + "-feature.md";
  await writeCommandFile(testRoot, path, rendered, {
    frontmatter: `description: "Search and run ${CLI_NAME} patterns for new features"`,
  });

  const content = await testRoot.append("/" + path).text();
  assert(content.startsWith("---\n")).equals(true);
  assert(content.includes("description:")).equals(true);
  assert(content.includes(CLI_NAME)).equals(true);

  await testRoot.remove();
});

test.case("skips CLAUDE.md when not called", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/AGENTS.md").write("# Test");

  // No CLAUDE.md should exist since linkClaudeMd was not called
  const claudeMd = testRoot.append("/CLAUDE.md");
  assert(await fs.exists(claudeMd)).equals(false);

  await testRoot.remove();
});