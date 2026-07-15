import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { writeSkillFile } from "#scaffold/write";
import { CLI_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

test.case("should write skill file with constants substituted", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = `Search and run ${CLI_NAME} outputs for new features.`;
  await writeSkillFile(testRoot, ".claude/skills/" + CLI_NAME + "-feature.md", rendered);

  const content = await testRoot.append("/.claude/skills/" + CLI_NAME + "-feature.md").text();
  assert(content.includes(CLI_NAME)).equals(true);
  assert(content.includes("{{CLI_NAME}}")).equals(false);

  await testRoot.remove();
});

test.case("should create parent directories", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = "test content";
  await writeSkillFile(testRoot, ".pi/skills/" + CLI_NAME + "-feature.md", rendered);

  assert(await fs.exists(testRoot.append("/.pi/skills/" + CLI_NAME + "-feature.md"))).equals(true);

  await testRoot.remove();
});

test.case("should write content verbatim (frontmatter lives in the template)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = "---\nname: test\ndescription: \"desc\"\n---\nplain content";
  await writeSkillFile(testRoot, ".claude/skills/test.md", rendered);

  const content = await testRoot.append("/.claude/skills/test.md").text();
  assert(content.trim()).equals(rendered);

  await testRoot.remove();
});