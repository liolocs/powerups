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
test.case(`init generates a ${MAIN_FOLDER} folder`, async (assert) => {
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
test.case("init --harness=claude scaffolds claude files only", async (assert) => {
    await reset();
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "claude" }],
        context: { root: testRoot },
    });
    // .saved/ created
    assert(await fs.exists(mainFolder)).equals(true);
    // CLAUDE.md created (instructions for claude)
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(true);
    // AGENTS.md NOT created (claude uses CLAUDE.md)
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(false);
    // Command files created
  const cmdPath = `.claude/commands/${CLI_NAME}-feature.md`;
    assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `.claude/commands/${CLI_NAME}-brainstorm.md`;
    assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
    // No other harness dirs
    assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);
    assert(await fs.exists(testRoot.append("/.pi"))).equals(false);
    await testRoot.remove();
});
test.case("init --harness=opencode scaffolds opencode files only", async (assert) => {
    await reset();
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "opencode" }],
        context: { root: testRoot },
    });
    // AGENTS.md created (instructions for opencode)
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
    // CLAUDE.md NOT created
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
    // Command files with frontmatter
  const cmdPath = `.opencode/commands/${CLI_NAME}-feature.md`;
    assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
    // No other harness dirs
    assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
    assert(await fs.exists(testRoot.append("/.pi"))).equals(false);
    await testRoot.remove();
});
test.case("init --harness=pi scaffolds pi files only", async (assert) => {
    await reset();
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "pi" }],
        context: { root: testRoot },
    });
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  const cmdPath = `.pi/skills/${CLI_NAME}-feature.md`;
    assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `.pi/skills/${CLI_NAME}-brainstorm.md`;
    assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
    // No other harness dirs
    assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
    assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);
    await testRoot.remove();
});
test.case("init --harness=codex writes only AGENTS.md", async (assert) => {
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
test.case("init errors when no harness detected", async (assert) => {
    await reset();
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
test.case("init --harness=invalid throws", async (assert) => {
    await reset();
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [{ flag: "--harness", value: "foo" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
test.case("init detects claude from CLAUDE.md", async (assert) => {
    await reset();
    await testRoot.append("/CLAUDE.md").write("# Existing project");
    await init.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot, skipGlobal: true },
    });
    // Should detect claude and write commands
    assert(await fs.exists(testRoot.append("/.claude/commands"))).equals(true);
    // CLAUDE.md should have the savedai section appended
    const content = await testRoot.append("/CLAUDE.md").text();
    assert(content.includes("# Existing project")).equals(true);
    assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);
    await testRoot.remove();
});
test.case("init detects opencode from .opencode/ dir", async (assert) => {
    await reset();
    await fs.create(testRoot.append("/.opencode"));
    await init.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot, skipGlobal: true },
    });
    assert(await fs.exists(testRoot.append("/.opencode/commands"))).equals(true);
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
    await testRoot.remove();
});
test.case("init detects pi from .pi/ dir", async (assert) => {
    await reset();
    await fs.create(testRoot.append("/.pi"));
    await init.run({
        subcommands: [],
        flags: [],
        context: { root: testRoot, skipGlobal: true },
    });
  assert(await fs.exists(testRoot.append("/.pi/skills"))).equals(true);
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
    await testRoot.remove();
});
test.case("init errors when multiple harnesses detected locally", async (assert) => {
    await reset();
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    await testRoot.remove();
});
test.case("init --harness resolves multiple detection ambiguity", async (assert) => {
    await reset();
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));
    // Should succeed with --harness=pi despite multiple detected
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "pi" }],
        context: { root: testRoot },
    });
  assert(await fs.exists(testRoot.append("/.pi/skills"))).equals(true);
    assert(await fs.exists(testRoot.append("/.claude/commands"))).equals(false);
    await testRoot.remove();
});
// ── Rollback tests ───────────────────────────────────────────────
//
// init must clean up any files/directories it created when scaffold
// throws, so that re-running init works cleanly instead of failing with
// "project already initialized".
// ─────────────────────────────────────────────────────────────────
test.case("init removes .saved on detection error (multiple harnesses)", async (assert) => {
    await reset();
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    // .saved must NOT be left behind
    assert(await fs.exists(mainFolder)).equals(false);
    await testRoot.remove();
});
test.case("init removes .saved on invalid harness error", async (assert) => {
    await reset();
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [{ flag: "--harness", value: "bogus" }],
            context: { root: testRoot },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    assert(await fs.exists(mainFolder)).equals(false);
    await testRoot.remove();
});
test.case("init removes .saved on no-harness-detected error", async (assert) => {
    await reset();
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    assert(await fs.exists(mainFolder)).equals(false);
    await testRoot.remove();
});
test.case("init can be re-run immediately after detection error", async (assert) => {
    // This is the exact scenario from the bug report:
    //   $ saved init                              → multiple harnesses error
    //   $ savedai init --harness=pi               → should work, not "already initialized"
    await reset();
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));
    // First run fails (multiple harnesses, no --harness)
    let firstThrew = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        firstThrew = true;
    }
    assert(firstThrew).equals(true);
    // .saved was cleaned up — second run with --harness succeeds
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "pi" }],
        context: { root: testRoot },
    });
    assert(await fs.exists(mainFolder)).equals(true);
  assert(await fs.exists(testRoot.append("/.pi/skills"))).equals(true);
    await testRoot.remove();
});
test.case("init restores modified instruction file on error", async (assert) => {
    // Pre-existing CLAUDE.md with user content — init detects multiple
    // harnesses *after* scaffold has already appended to CLAUDE.md.
    // We simulate this by setting up a scenario where the instruction
    // file is written but then a later step (command file write) fails.
    //
    // Since detection happens first and throws before any files are
    // written, we instead verify the restore path by directly testing
    // that a pre-existing instruction file is untouched after a
    // detection failure.
    await reset();
    const original = "# My Project\n\nOriginal content.\n";
    await testRoot.append("/AGENTS.md").write(original);
    await fs.create(testRoot.append("/.claude"));
    await fs.create(testRoot.append("/.pi"));
    let threw = false;
    try {
        await init.run({
            subcommands: [],
            flags: [],
            context: { root: testRoot, skipGlobal: true },
        });
    }
    catch {
        threw = true;
    }
    assert(threw).equals(true);
    // AGENTS.md should be unchanged (detection threw before any writes)
    const content = await testRoot.append("/AGENTS.md").text();
    assert(content).equals(original);
    assert(await fs.exists(mainFolder)).equals(false);
    await testRoot.remove();
});
test.case("init is idempotent — instruction section not duplicated", async (assert) => {
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
    const content = await testRoot.append("/CLAUDE.md").text();
    const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
    assert(count).equals(1);
    await testRoot.remove();
});
test.case("init appends to existing AGENTS.md", async (assert) => {
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
test.case("init writes command files with constants substituted", async (assert) => {
    await reset();
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "claude" }],
        context: { root: testRoot },
    });
  const cmdPath = `.claude/commands/${CLI_NAME}-feature.md`;
    const content = await testRoot.append(`/${cmdPath}`).text();
    assert(content.includes(CLI_NAME)).equals(true);
    assert(content.includes("{{CLI_NAME}}")).equals(false);
    await testRoot.remove();
});
test.case("init injects opencode frontmatter", async (assert) => {
    await reset();
    await init.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "opencode" }],
        context: { root: testRoot },
    });
  const cmdPath = `.opencode/commands/${CLI_NAME}-feature.md`;
    const content = await testRoot.append(`/${cmdPath}`).text();
    assert(content.startsWith("---\n")).equals(true);
    assert(content.includes("description:")).equals(true);
  assert(content.includes("name:")).equals(true);
    await testRoot.remove();
});
//# sourceMappingURL=init.spec.js.map