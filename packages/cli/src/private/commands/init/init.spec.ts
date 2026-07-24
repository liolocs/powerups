import test from "@rcompat/test";
import init from "#commands/init/index";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER, CLI_NAME, CONFIG_FILE, HARNESS_FINGERPRINTS, SKILLS_DIRS } from "#constants";
import { CodeError } from "@rcompat/error";
import { InitErrorCode } from "#errors/initErrors";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

test.case(`init generates a ${MAIN_FOLDER} folder globally`, async assert => {
  await reset();

  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  const globalFolder = testRoot.append(`/${MAIN_FOLDER}`);
  assert(await fs.exists(globalFolder)).equals(true);

  await testRoot.remove();
});

test.case("init claude scaffolds claude files only", async assert => {
  await reset();

  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // CLAUDE.md created (instructions for claude)
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(true);
  // AGENTS.md NOT created (claude uses CLAUDE.md)
  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(false);
  // Command files created
  const cmdPath = `.claude/skills/${CLI_NAME}-implement.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `.claude/skills/${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
  const capturePath = `.claude/skills/${CLI_NAME}-capture.md`;
  assert(await fs.exists(testRoot.append(`/${capturePath}`))).equals(true);
  // No other harness dirs
  assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);
  assert(await fs.exists(testRoot.append("/.pi"))).equals(false);

  await testRoot.remove();
});

test.case("init opencode scaffolds opencode files only", async assert => {
  await reset();

  await init.run({
    subcommands: ["opencode"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // AGENTS.md created (instructions for opencode)
  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  // CLAUDE.md NOT created
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  // Command files created
  const cmdPath = `.opencode/skills/${CLI_NAME}-implement.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `.opencode/skills/${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
  const capturePath = `.opencode/skills/${CLI_NAME}-capture.md`;
  assert(await fs.exists(testRoot.append(`/${capturePath}`))).equals(true);
  // No other harness dirs
  assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
  assert(await fs.exists(testRoot.append("/.pi"))).equals(false);

  await testRoot.remove();
});

test.case("init pi scaffolds pi files only", async assert => {
  await reset();

  await init.run({
    subcommands: ["pi"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  const cmdPath = `${HARNESS_FINGERPRINTS.pi}/skills/${CLI_NAME}-implement.md`;
  assert(await fs.exists(testRoot.append(`/${cmdPath}`))).equals(true);
  const brainstormPath = `${HARNESS_FINGERPRINTS.pi}/skills/${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
  const capturePath = `${HARNESS_FINGERPRINTS.pi}/skills/${CLI_NAME}-capture.md`;
  assert(await fs.exists(testRoot.append(`/${capturePath}`))).equals(true);
  // No other harness dirs
  assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
  assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);

  await testRoot.remove();
});

test.case("init codex scaffolds codex files", async assert => {
  await reset();

  await init.run({
    subcommands: ["codex"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
  assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);
  // Skill files created
  const implementPath = `.codex/skills/${CLI_NAME}-implement.md`;
  assert(await fs.exists(testRoot.append(`/${implementPath}`))).equals(true);
  const brainstormPath = `.codex/skills/${CLI_NAME}-brainstorm.md`;
  assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).equals(true);
  const capturePath = `.codex/skills/${CLI_NAME}-capture.md`;
  assert(await fs.exists(testRoot.append(`/${capturePath}`))).equals(true);
  // No other harness dirs
  assert(await fs.exists(testRoot.append("/.claude"))).equals(false);
  assert(await fs.exists(testRoot.append("/.opencode"))).equals(false);
  assert(await fs.exists(testRoot.append("/.pi"))).equals(false);

  await testRoot.remove();
});

test.group("init errors", () => {
  test.case("should fail with the correct error when no harness detected",
    async assert => {
      await reset();

      let threw;
      try {
        await init.run({
          subcommands: [],
          flags: [],
          context: { homeDir: testRoot.path },
        });
      } catch (e: unknown) {
        assert(e instanceof CodeError).true();
        threw = (e as CodeError).code;
      }
      assert(threw).equals(InitErrorCode.no_harness_detected);

      await testRoot.remove();
    });

  test.case("should fail with invalid_harness when harness value is invalid", async assert => {
    await reset();

    let threw;
    try {
      await init.run({
        subcommands: ["foo"],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);

    await testRoot.remove();
  });

  test.case("should fail with global_already_initialized when already initialized", async assert => {
    await reset();

    // First run succeeds and creates ~/.powerups
    await init.run({
      subcommands: ["claude"],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    // Second run should fail because ~/.powerups already exists
    let threw;
    try {
      await init.run({
        subcommands: ["claude"],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.global_already_initialized);

    await testRoot.remove();
  });
});

test.group("init detection (global fingerprints)", () => {
  test.case("should detect claude from .claude/ dir", async assert => {
    await reset();
    await fs.create(testRoot.append("/.claude"));

    await init.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    // Should detect claude and write commands
    assert(await fs.exists(testRoot.append("/.claude/skills"))).equals(true);
    // CLAUDE.md should have the powerups section appended
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(true);

    await testRoot.remove();
  });

  test.case("should detect opencode", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.opencode}`));

    await init.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    assert(await fs.exists(testRoot.append("/.opencode/skills"))).equals(true);
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(false);

    await testRoot.remove();
  });

  test.case("should detect pi", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));

    await init.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).equals(true);
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);

    await testRoot.remove();
  });

  test.case("should detect multiple harnesses and scaffold to all", async assert => {
    await reset();
    // Create global fingerprints for both claude and pi
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.claude}`));
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));

    await init.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    // Both should get scaffolded
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.claude}`))).equals(true);
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).equals(true);
    // CLAUDE.md for claude, AGENTS.md for pi
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).equals(true);
    assert(await fs.exists(testRoot.append("/AGENTS.md"))).equals(true);

    await testRoot.remove();
  });

  test.case("should resolve multiple detection with harness arg (single only)", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.claude}`));
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));

    // Should scaffold only to pi despite multiple detected
    await init.run({
      subcommands: ["pi"],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).equals(true);
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.claude}`))).equals(false);

    await testRoot.remove();
  });
});

test.group("init rollback", () => {
  test.case(`should remove ${MAIN_FOLDER} on detection error (no harness detected)`, async assert => {
    await reset();

    let threw;
    try {
      await init.run({
        subcommands: [],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    // ~/.powerups must NOT be left behind
    assert(await fs.exists(testRoot.append(`/${MAIN_FOLDER}`))).equals(false);

    await testRoot.remove();
  });

  test.case(`should remove ${MAIN_FOLDER} on invalid harness error`, async assert => {
    await reset();

    let threw;
    try {
      await init.run({
        subcommands: ["bogus"],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);

    assert(await fs.exists(testRoot.append(`/${MAIN_FOLDER}`))).equals(false);

    await testRoot.remove();
  });

  test.case("should be re-runnable immediately after detection error", async assert => {
    await reset();
    // No harness fingerprints → no harness detected error
    let firstThrew = false;
    try {
      await init.run({
        subcommands: [],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch {
      firstThrew = true;
    }
    assert(firstThrew).equals(true);

    // ~/.powerups was cleaned up — second run with harness arg succeeds
    await init.run({
      subcommands: ["pi"],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    assert(await fs.exists(testRoot.append(`/${MAIN_FOLDER}`))).equals(true);
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).equals(true);

    await testRoot.remove();
  });

  test.case("should restore modified instruction file on error", async assert => {
    // Pre-existing AGENTS.md with user content — init detects no harness
    // (no fingerprints in test dir) and throws before any writes.
    await reset();
    const original = "# My Project\n\nOriginal content.\n";
    await testRoot.append("/AGENTS.md").write(original);

    let threw;
    try {
      await init.run({
        subcommands: [],
        flags: [],
        context: { homeDir: testRoot.path },
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    // AGENTS.md should be unchanged (detection threw before any writes)
    const content = await testRoot.append("/AGENTS.md").text();
    assert(content).equals(original);
    assert(await fs.exists(testRoot.append(`/${MAIN_FOLDER}`))).equals(false);

    await testRoot.remove();
  });
});

test.case("init is idempotent — instruction section not duplicated", async assert => {
  await reset();

  // First run
  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // Remove ~/.powerups so second init can proceed
  await testRoot.append(`/${MAIN_FOLDER}`).remove();

  // Second run
  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  const content = await testRoot.append("/CLAUDE.md").text();
  const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("init appends to existing AGENTS.md", async assert => {
  await reset();
  await testRoot.append("/AGENTS.md").write("# My Project\n\nExisting content.");

  await init.run({
    subcommands: ["codex"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  const content = await testRoot.append("/AGENTS.md").text();
  assert(content.includes("# My Project")).equals(true);
  assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  await testRoot.remove();
});

test.case("init writes skill files with constants substituted", async assert => {
  await reset();

  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  const cmdPath = `.claude/skills/${CLI_NAME}-implement.md`;
  const content = await testRoot.append(`/${cmdPath}`).text();
  assert(content.includes(CLI_NAME)).equals(true);
  assert(content.includes("{{CLI_NAME}}")).equals(false);

  await testRoot.remove();
});

test.case(`init writes ${CLI_NAME}-implement skill file for each harness`, async assert => {
  for (const harness of ["claude", "opencode", "pi", "codex"] as const) {
    await reset();

    await init.run({
      subcommands: [harness],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    const outputPath = `${SKILLS_DIRS[harness]}/${CLI_NAME}-implement.md`;

    try {
      console.log({ outputPath: JSON.stringify(outputPath, null, 2) });
      const pathExists = await fs.exists(testRoot.append(`/${outputPath}`));
      assert(pathExists).equals(true);

      const content = await testRoot.append(`/${outputPath}`).text();
      assert(content.includes(CLI_NAME)).equals(true);
      assert(content.includes("{{CLI_NAME}}")).equals(false);
      assert(content.includes("$ARGUMENTS")).equals(false);
    } catch (e) {
      console.error(e);
      assert(e).fail();
    }

    await testRoot.remove();
  }
});

test.case("init injects frontmatter into skill files for every harness", async assert => {
  for (const harness of ["claude", "opencode", "pi", "codex"] as const) {
    await reset();

    await init.run({
      subcommands: [harness],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    const cmdPath = `${SKILLS_DIRS[harness]}/${CLI_NAME}-implement.md`;
    const content = await testRoot.append(`/${cmdPath}`).text();

    assert(content.startsWith("---\n")).equals(true);
    assert(content.includes("description:")).equals(true);
    assert(content.includes(`name: ${CLI_NAME}-implement`)).equals(true);

    await testRoot.remove();
  }
});

test.group("init config", () => {
  test.case("init writes global config.json with packages only (no harness)", async assert => {
    await reset();

    await init.run({
      subcommands: ["pi"],
      flags: [],
      context: { homeDir: testRoot.path },
    });

    const configPath = testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);
    assert(await fs.exists(configPath)).equals(true);

    const config = JSON.parse(await configPath.text());
    assert(config.harness).equals(undefined);
    assert(config.packages).equals([]);

    await testRoot.remove();
  });

  test.case("init writes config.json for every harness", async assert => {
    for (const harness of ["claude", "opencode", "pi", "codex"] as const) {
      await reset();

      await init.run({
        subcommands: [harness],
        flags: [],
        context: { homeDir: testRoot.path },
      });

      const configPath = testRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);
      const config = JSON.parse(await configPath.text());
      assert(config.harness).equals(undefined);
      assert(config.packages).equals([]);

      await testRoot.remove();
    }
  });
});