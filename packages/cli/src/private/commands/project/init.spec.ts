import test from "@rcompat/test";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import projectInit from "#commands/project/init";
import { CodeError } from "@rcompat/error";
import { ProjectErrorCode } from "#errors/projectErrors";
import { InitErrorCode } from "#errors/initErrors";
import captureStdout from "#test-utils/capture-stdout";
import { readGlobalConfig } from "#utils/config";
import { CLI_FOLDER_NAME, CLI_NAME, CONFIG_FILE_NAME, HARNESS_FINGERPRINTS, SKILLS_DIRS } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp/project-init-spec");
const homeRoot = root.append("/tmp/project-init-home");
const mainFolder = testRoot.append(`/${CLI_FOLDER_NAME}`);
const globalFolder = homeRoot.append(`/${CLI_FOLDER_NAME}`);

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
  await homeRoot.remove();
  await fs.create(homeRoot);
}

const ctx = () => ({ root: testRoot, homeDir: homeRoot.path });

test.group("project init — config + global bootstrap", () => {
  test.case("creates .powerups folder in the project", async assert => {
    await reset();

    await projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() });

    assert(await fs.exists(mainFolder)).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("writes config.json with empty packages", async assert => {
    await reset();

    await projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() });

    const configPath = mainFolder.append(`/${CONFIG_FILE_NAME}`);
    assert(await fs.exists(configPath)).true();
    const config = await configPath.json() as Record<string, unknown>;
    assert(config.packages).equals([]);

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("config.json has no harness field", async assert => {
    await reset();

    await projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() });

    const config = await mainFolder.append(`/${CONFIG_FILE_NAME}`).json() as Record<string, unknown>;
    assert("harness" in config).false();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("throws project_already_initialized when .powerups already exists", async assert => {
    await reset();
    await fs.create(mainFolder);

    let threw;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(ProjectErrorCode.project_already_initialized);

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("prints success message", async assert => {
    await reset();

    const output = await captureStdout(() =>
      projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() }),
    );

    assert(output.includes("Initialized")).true();
    assert(output.includes(CLI_NAME)).true();

    await testRoot.remove();
    await homeRoot.remove();
  });
});

test.group("project init — global bootstrap", () => {
  test.case("bootstraps ~/.powerups when it doesn't exist", async assert => {
    await reset();
    assert(await fs.exists(globalFolder)).false();

    await projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() });

    assert(await fs.exists(globalFolder)).true();
    const config = await readGlobalConfig(homeRoot.path);
    assert(config?.packages).equals([]);

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("does not re-create ~/.powerups when it already exists", async assert => {
    await reset();
    await fs.create(globalFolder);
    await globalFolder.append(`/${CONFIG_FILE_NAME}`).writeJSON({ packages: ["existing"] });

    await projectInit.run({ subcommands: [], flags: [{ flag: "--harness", value: "claude" }], context: ctx() });

    const config = await readGlobalConfig(homeRoot.path);
    assert(config?.packages).equals(["existing"]);
    assert(await fs.exists(mainFolder)).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("bootstraps global even when harness scaffold fails", async assert => {
    await reset();
    let threw;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    // global store WAS created (bootstrap runs before scaffold)
    assert(await fs.exists(globalFolder)).true();
    // project store was rolled back
    assert(await fs.exists(mainFolder)).false();

    await testRoot.remove();
    await homeRoot.remove();
  });
});

test.group("project init — harness scaffold (per harness)", () => {
  for (const harness of ["claude", "opencode", "pi", "codex"] as const) {
    test.case(`--harness ${harness} scaffolds ${harness} files only`, async assert => {
      await reset();

      await projectInit.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: harness }],
        context: ctx(),
      });

      const implementPath = `${SKILLS_DIRS[harness]}/${CLI_NAME}-implement.md`;
      const brainstormPath = `${SKILLS_DIRS[harness]}/${CLI_NAME}-brainstorm.md`;
      const capturePath = `${SKILLS_DIRS[harness]}/${CLI_NAME}-capture.md`;
      assert(await fs.exists(testRoot.append(`/${implementPath}`))).true();
      assert(await fs.exists(testRoot.append(`/${brainstormPath}`))).true();
      assert(await fs.exists(testRoot.append(`/${capturePath}`))).true();

      // instruction file
      const instruction = harness === "claude" ? "CLAUDE.md" : "AGENTS.md";
      assert(await fs.exists(testRoot.append(`/${instruction}`))).true();
      // claude never writes AGENTS.md; others never write CLAUDE.md
      if (harness === "claude") {
        assert(await fs.exists(testRoot.append("/AGENTS.md"))).false();
      } else {
        assert(await fs.exists(testRoot.append("/CLAUDE.md"))).false();
      }

      await testRoot.remove();
      await homeRoot.remove();
    });
  }

  test.case("writes skill files with constants substituted", async assert => {
    await reset();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude" }],
      context: ctx(),
    });

    const cmdPath = `.claude/skills/${CLI_NAME}-implement.md`;
    const content = await testRoot.append(`/${cmdPath}`).text();
    assert(content.includes(CLI_NAME)).true();
    assert(content.includes("{{CLI_NAME}}")).false();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("injects frontmatter into skill files", async assert => {
    await reset();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude" }],
      context: ctx(),
    });

    const cmdPath = `.claude/skills/${CLI_NAME}-implement.md`;
    const content = await testRoot.append(`/${cmdPath}`).text();
    assert(content.startsWith("---\n")).true();
    assert(content.includes("description:")).true();
    assert(content.includes(`name: ${CLI_NAME}-implement`)).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("appends to existing AGENTS.md", async assert => {
    await reset();
    await testRoot.append("/AGENTS.md").write("# My Project\n\nExisting content.");

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "codex" }],
      context: ctx(),
    });

    const content = await testRoot.append("/AGENTS.md").text();
    assert(content.includes("# My Project")).true();
    assert(content.includes(`<!-- BEGIN ${CLI_NAME} -->`)).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("is idempotent — instruction section not duplicated", async assert => {
    await reset();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude" }],
      context: ctx(),
    });
    // remove project .powerups so a second init can proceed
    await mainFolder.remove();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude" }],
      context: ctx(),
    });

    const content = await testRoot.append("/CLAUDE.md").text();
    const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
    assert(count).equals(1);

    await testRoot.remove();
    await homeRoot.remove();
  });
});

test.group("project init — detection from project root", () => {
  test.case("detects claude from project-root fingerprint, not home dir", async assert => {
    await reset();
    await fs.create(testRoot.append("/.claude"));
    // home dir deliberately has NO fingerprints

    await projectInit.run({ subcommands: [], flags: [], context: ctx() });

    assert(await fs.exists(testRoot.append("/.claude/skills"))).true();
    assert(await fs.exists(testRoot.append("/CLAUDE.md"))).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("detects multiple harnesses from project root and scaffolds all", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.claude}`));
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));

    await projectInit.run({ subcommands: [], flags: [], context: ctx() });

    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.claude}`))).true();
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("--harness overrides detection to a single harness", async assert => {
    await reset();
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.claude}`));
    await fs.create(testRoot.append(`/${HARNESS_FINGERPRINTS.pi}`));

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "pi" }],
      context: ctx(),
    });

    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).true();
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.claude}`))).false();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("throws no_harness_detected when project has no fingerprints and no --harness", async assert => {
    await reset();

    let threw;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("throws invalid_harness for a bad --harness value", async assert => {
    await reset();

    let threw;
    try {
      await projectInit.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "bogus" }],
        context: ctx(),
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);

    await testRoot.remove();
    await homeRoot.remove();
  });
});

test.group("project init — comma-separated --harness", () => {
  test.case("scaffolds both harnesses", async assert => {
    await reset();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude,pi" }],
      context: ctx(),
    });

    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.claude}`))).true();
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("dedupes repeated harnesses", async assert => {
    await reset();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "claude,claude" }],
      context: ctx(),
    });

    const content = await testRoot.append("/CLAUDE.md").text();
    const count = (content.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
    assert(count).equals(1);

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("throws invalid_harness naming the bad token", async assert => {
    await reset();

    let threw;
    try {
      await projectInit.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "claude,bogus" }],
        context: ctx(),
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);

    await testRoot.remove();
    await homeRoot.remove();
  });
});

test.group("project init — rollback", () => {
  test.case("removes .powerups on no_harness_detected", async assert => {
    await reset();

    let threw;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);
    assert(await fs.exists(mainFolder)).false();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("removes .powerups on invalid_harness", async assert => {
    await reset();

    let threw;
    try {
      await projectInit.run({
        subcommands: [],
        flags: [{ flag: "--harness", value: "bogus" }],
        context: ctx(),
      });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.invalid_harness);
    assert(await fs.exists(mainFolder)).false();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("is re-runnable immediately after a detection error", async assert => {
    await reset();
    let firstThrew = false;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch {
      firstThrew = true;
    }
    assert(firstThrew).true();

    await projectInit.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "pi" }],
      context: ctx(),
    });

    assert(await fs.exists(mainFolder)).true();
    assert(await fs.exists(testRoot.append(`/${SKILLS_DIRS.pi}`))).true();

    await testRoot.remove();
    await homeRoot.remove();
  });

  test.case("restores a pre-existing instruction file when detection throws", async assert => {
    await reset();
    const original = "# My Project\n\nOriginal content.\n";
    await testRoot.append("/AGENTS.md").write(original);

    let threw;
    try {
      await projectInit.run({ subcommands: [], flags: [], context: ctx() });
    } catch (e: unknown) {
      assert(e instanceof CodeError).true();
      threw = (e as CodeError).code;
    }
    assert(threw).equals(InitErrorCode.no_harness_detected);

    const content = await testRoot.append("/AGENTS.md").text();
    assert(content).equals(original);
    assert(await fs.exists(mainFolder)).false();

    await testRoot.remove();
    await homeRoot.remove();
  });
});