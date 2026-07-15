import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { writeToAgentsOrClaudeMD } from "#scaffold/agents";
import { runTemplate } from "#runners/index";
import {
  CLI_NAME,
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  TEMPLATE_FOLDER,
  FEATURE_FOLDER,
} from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const scaffoldDir = fs.ref(import.meta.dirname);

async function renderAgents(): Promise<string> {
  return await runTemplate({
    templatePath: scaffoldDir.append("/agents.njk"),
    variables: {
      CLI_NAME,
      MAIN_FOLDER,
      OUTPUT_FOLDER,
      TEMPLATE_FOLDER,
      FEATURE_FOLDER,
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
  assert(content.includes(`"includes"`)).equals(true);
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

test.case("should render template vs feature content", async assert => {
  await testRoot.remove();
  await fs.create(testRoot);

  const rendered = await renderAgents();
  await writeToAgentsOrClaudeMD(testRoot, "AGENTS.md", rendered, CLI_NAME);

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("template")).equals(true);
  assert(content.includes("feature")).equals(true);
  assert(content.includes("Template vs Feature")).equals(true);
  assert(content.includes("Modify templates")).equals(true);
  assert(content.includes("outputPathOverride")).equals(true);
  assert(content.includes("doctor")).equals(true);

  await testRoot.remove();
});