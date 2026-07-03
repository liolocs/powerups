import test from "@rcompat/test";
import init from "#commands/init";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");
const mainFolder = testRoot.append(`/${MAIN_FOLDER}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.case(`init generates a ${MAIN_FOLDER} folder`, async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  const hasDryFolder = await fs.exists(mainFolder);
  assert(hasDryFolder).equals(true);

  await testRoot.remove();

  const hasDryFolderAgain = await fs.exists(mainFolder);
  assert(hasDryFolderAgain).equals(false);
});

test.case("init --harness=claude scaffolds claude files", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  // .saved/ created
  assert(await fs.exists(mainFolder)).equals(true);
  // AGENTS.md created
  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  // CLAUDE.md created (symlink or @AGENTS.md)
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(true);
  // Command file created
  const cmdPath = `.claude/commands/new-${CLI_NAME}-feature.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  // Brainstorm command created
  const brainstormPath = `.claude/commands/new-${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);

  await testRoot.remove();
});

test.case("init --harness=opencode scaffolds opencode files (no CLAUDE.md)", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "opencode" }],
    context: { root: testRoot },
  });

  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  const cmdPath = `.opencode/commands/new-${CLI_NAME}-feature.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);

  await testRoot.remove();
});

test.case("init --harness=pi scaffolds pi files", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "pi" }],
    context: { root: testRoot },
  });

  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  const cmdPath = `.pi/prompts/new-${CLI_NAME}-feature.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `.pi/prompts/new-${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);

  await testRoot.remove();
});

test.case("init --harness=codex writes only AGENTS.md", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "codex" }],
    context: { root: testRoot },
  });

  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
  assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);
  assert(await fs.exists(testRoot.append("/.pi"))).equals(false);

  await testRoot.remove();
});

test.case("init errors when no harness detected", async assert => {
  await reset();

  let threw = false;
  try {
    await init.run({
      subcommands: [],
      flags: [],
      context: { root: testRoot, skipGlobal: true },
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("init --harness=invalid throws", async assert => {
  await reset();

  let threw = false;
  try {
    await init.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "foo" }],
      context: { root: testRoot },
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});

test.case("init detects claude from CLAUDE.md symlink", async assert => {
  await reset();
  // Create AGENTS.md first, then symlink CLAUDE.md → AGENTS.md.
  // Detection finds CLAUDE.md → claude; linkClaudeMd sees symlink → skips.
  await testRoot.append("/AGENTS.md").write("# Existing");
  const { symlink } = await import("node:fs/promises");
  await symlink("AGENTS.md", testRoot.append("/CLAUDE.md").path);

  await init.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot, skipGlobal: true },
  });

  assert(await fs.exists(testRoot.append("/.claude/commands"))).equals(true);

  await testRoot.remove();
});

test.case("init detects opencode from .opencode/ dir", async assert => {
  await reset();
  await fs.create(testRoot.append("/.opencode"));

  await init.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot, skipGlobal: true },
  });

  assert(await fs.exists(testRoot.append("/.opencode/commands"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);

  await testRoot.remove();
});

test.case("init detects pi from .pi/ dir", async assert => {
  await reset();
  await fs.create(testRoot.append("/.pi"));

  await init.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot, skipGlobal: true },
  });

  assert(await fs.exists(testRoot.append("/.pi/prompts"))).equals(true);

  await testRoot.remove();
});

test.case("init detects multiple harnesses", async assert => {
  await reset();
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi"));

  await init.run({
    subcommands: [],
    flags: [],
    context: { root: testRoot, skipGlobal: true },
  });

  assert(await fs.exists(testRoot.append("/.claude/commands"))).equals(true);
  assert(await fs.exists(testRoot.append("/.pi/prompts"))).equals(true);

  await testRoot.remove();
});

test.case("init is idempotent — AGENTS.md not duplicated", async assert => {
  await reset();

  // First run
  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  // Remove .saved so second init can proceed
  await testRoot.append(`/${MAIN_FOLDER}`).remove();

  // Second run
  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  const content = await testRoot.append("/AGENTS.md").text();
  const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("init appends to existing AGENTS.md", async assert => {
  await reset();
  await testRoot.append("/AGENTS.md").write("# My Project\n\nExisting content.");

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "codex" }],
    context: { root: testRoot },
  });

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("# My Project")).equals(true);
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  await testRoot.remove();
});

test.case("init writes command files with constants substituted", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { root: testRoot },
  });

  const cmdPath = `.claude/commands/new-${CLI_NAME}-feature.md`;
  const content = await testRoot.append(`/${cmdPath}`).text();
  assert(content.includes(CLI_NAME)).equals(true);
  assert(content.includes("{{CLI_NAME}}")).equals(false);

  await testRoot.remove();
});

test.case("init injects opencode frontmatter", async assert => {
  await reset();

  await init.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "opencode" }],
    context: { root: testRoot },
  });

  const cmdPath = `.opencode/commands/new-${CLI_NAME}-feature.md`;
  const content = await testRoot.append(`/${cmdPath}`).text();
  assert(content.startsWith("---\n")).equals(true);
  assert(content.includes("description:")).equals(true);

  await testRoot.remove();
});

test.case("init errors if CLAUDE.md exists and is not symlink", async assert => {
  await reset();
  await testRoot.append("/CLAUDE.md").write("# My file");

  let threw = false;
  try {
    await init.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude" }],
      context: { root: testRoot },
    });
  } catch {
    threw = true;
  }
  assert(threw).equals(true);

  await testRoot.remove();
});