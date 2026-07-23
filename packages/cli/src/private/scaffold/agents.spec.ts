import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { runTemplate } from "#template-runners/index";
import {
  CLI_NAME,
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const scaffoldDir = fs.ref(import.meta.dirname);

async function renderAgents(): Promise<string> {
  return await runTemplate({
    templatePath: scaffoldDir.append("/templates/agents.njk"),
    variables: {
      CLI_NAME,
      MAIN_FOLDER,
      INTERNAL_FOLDER,
      SRC_FOLDER,
      ACTIVE_FOLDER,
      MULTI_USE_FOLDER,
      SINGLE_USE_FOLDER,
    },
  });
}

test.case("should create AGENTS.md when absent", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "AGENTS.md", rendered, CLI_NAME);

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);
  assert(content.includes(`<!-- END ${CLI_NAME} -->`)).equals(true);
  assert(content.includes("Subtemplates")).equals(true);
  assert(content.includes(`"steps"`)).equals(true);
  assert(content.includes("{{parentVar}}")).equals(true);
  assert(content.includes("{{modelName}}")).equals(true);

  await testRoot.remove();
});

test.case("should create CLAUDE.md when absent", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "CLAUDE.md", rendered, CLI_NAME);

  const content = await testRoot.append("/CLAUDE.md").text();
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  await testRoot.remove();
});

test.case("should append to existing file without section", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  await testRoot.append("/AGENTS.md").write("# Existing project\n\nSome content.");

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "AGENTS.md", rendered, CLI_NAME);

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("# Existing project")).equals(true);
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  await testRoot.remove();
});

test.case("should replace existing section (idempotent)", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const oldContent = "# Project\n\n<!-- BEGIN " + CLI_NAME + " -->\nOLD CONTENT\n<!-- END " + CLI_NAME + " -->\n";
  await testRoot.append("/AGENTS.md").write(oldContent);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "AGENTS.md", rendered, CLI_NAME);

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("# Project")).equals(true);
  assert(content.includes("OLD CONTENT")).equals(false);
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);
  const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("should work for CLAUDE.md same as AGENTS.md", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);
  const oldContent = "# My Claude\n\n<!-- BEGIN " + CLI_NAME + " -->\nOLD\n<!-- END " + CLI_NAME + " -->\n";
  await testRoot.append("/CLAUDE.md").write(oldContent);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "CLAUDE.md", rendered, CLI_NAME);

  const content = await testRoot.append("/CLAUDE.md").text();
  assert(content.includes("# My Claude")).equals(true);
  assert(content.includes("OLD")).equals(false);
  const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("should render multi-use vs single-use content", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "AGENTS.md", rendered, CLI_NAME);

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("multi-use")).equals(true);
  assert(content.includes("single-use")).equals(true);
  assert(content.includes("Multi-use vs Single-use")).equals(true);
  assert(content.includes("Modify templates")).equals(true);
  assert(content.includes("stepOverride")).equals(true);
  assert(content.includes("exclude")).equals(true);
  assert(content.includes("doctor")).equals(true);
  assert(content.includes("Skills")).equals(true);
  assert(content.includes("brainstorm")).equals(true);
  assert(content.includes("implement")).equals(true);
  assert(content.includes("capture")).equals(true);
  assert(content.includes("find")).equals(true);
  assert(content.includes("pack")).equals(true);
  assert(content.includes("use")).equals(true);
  assert(content.includes("init")).equals(true);

  await testRoot.remove();
});