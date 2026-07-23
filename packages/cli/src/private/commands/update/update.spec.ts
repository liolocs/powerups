import test from "@rcompat/test";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import update from "#commands/update/index";
import init from "#commands/init/index";
import { CodeError } from "@rcompat/error";
import { InitErrorCode } from "#errors/initErrors";
import { UpdateErrorCode } from "#errors/updateErrors";
import { writeGlobalConfig } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

/** Run init globally to set up ~/.powerups, then return. */
async function setup(harness: string) {
  await init.run({
    subcommands: [harness],
    flags: [],
    context: { homeDir: testRoot.path },
  });
  // Some harness fingerprints are not created by scaffold (they come from
  // the harness installation itself). Create them so detectHarnesses can
  // find the harness when update runs without --harness.
  const extraFingerprints: Record<string, string> = {
    pi: ".pi/agent",
    opencode: ".config/opencode",
  };
  const fp = extraFingerprints[harness];
  if (fp) {
    const dir = testRoot.append(`/${fp}`);
    if (!(await fs.exists(dir))) {
      await fs.create(dir);
    }
  }
}

/** Create a local git repo to serve as a "remote" for clone/update tests. */
async function createRemoteRepo(
  dir: typeof testRoot,
  version: string,
  message: string,
) {
  await fs.create(dir);
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
  await dir.append("/package.json").write(
    JSON.stringify({
      name: "test-pkg",
      version,
      description: "test",
      keywords: ["powerups-package"],
      powerups: { active: { "multi-use": {}, "single-use": {} } },
    }),
  );
  await io.run("git add -A", { cwd: dir.path });
  await io.run(`git commit -m "${message}"`, { cwd: dir.path });
}

test.case("update with no flags fails", async assert => {
  await reset();
  await setup("claude");

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.no_mode);

  await testRoot.remove();
});

test.case("update --harness regenerates skill files globally", async assert => {
  await reset();
  await setup("pi");

  // Corrupt a skill file
  const skillPath = `.pi/skills/${CLI_NAME}-implement.md`;
  const skillRef = testRoot.append(`/${skillPath}`);
  await skillRef.write("CORRUPTED");

  // Run update --harness — should regenerate the file from the scaffold
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "" }],
    context: { homeDir: testRoot.path },
  });

  const content = await skillRef.text();
  assert(content.includes("CORRUPTED")).equals(false);
  assert(content.startsWith("---\n")).equals(true);
  assert(content.includes(`name: ${CLI_NAME}-implement`)).equals(true);

  await testRoot.remove();
});

test.case("update --harness regenerates instruction section in-place", async assert => {
  await reset();
  await setup("claude");

  // The CLAUDE.md should have the BEGIN/END section
  const agentsRef = testRoot.append("/CLAUDE.md");
  const before = await agentsRef.text();
  assert(before.includes(`<!-- BEGIN ${CLI_NAME} -->`)).equals(true);

  // Run update --harness
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "" }],
    context: { homeDir: testRoot.path },
  });

  // Section should still be there exactly once (not duplicated)
  const after = await agentsRef.text();
  const count = (after.match(new RegExp(`<!-- BEGIN ${CLI_NAME} -->`, "g")) ?? []).length;
  assert(count).equals(1);

  await testRoot.remove();
});

test.case("update --harness=claude scaffolds to specified harness only", async assert => {
  await reset();
  await setup("pi");

  // Update with a different harness
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "claude" }],
    context: { homeDir: testRoot.path },
  });

  // Claude files should now exist
  assert(await fs.exists(testRoot.append(`/.claude/skills`))).equals(true);

  await testRoot.remove();
});

test.case("update --harness fails when not initialized globally", async assert => {
  await reset();

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.global_not_initialized);

  await testRoot.remove();
});

test.case("update --harness fails with invalid harness", async assert => {
  await reset();
  await setup("pi");

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--harness", value: "bogus" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(InitErrorCode.invalid_harness);

  await testRoot.remove();
});

test.case("update --harness scaffolds to all detected harnesses", async assert => {
  await reset();
  // Create global fingerprints for both claude and pi
  await fs.create(testRoot.append("/.claude"));
  await fs.create(testRoot.append("/.pi/agent"));

  // First init with claude only
  await init.run({
    subcommands: ["claude"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // Now update --harness — should scaffold to all detected
  await update.run({
    subcommands: [],
    flags: [{ flag: "--harness", value: "" }],
    context: { homeDir: testRoot.path },
  });

  // Both should get scaffolded
  assert(await fs.exists(testRoot.append("/.claude/skills"))).equals(true);
  assert(await fs.exists(testRoot.append("/.pi/skills"))).equals(true);

  await testRoot.remove();
});

test.case("update --all --harness fails with conflicting_flags", async assert => {
  await reset();
  await setup("claude");

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--all", value: "" }, { flag: "--harness", value: "" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.conflicting_flags);

  await testRoot.remove();
});

test.case("update --packages --harness fails with conflicting_flags", async assert => {
  await reset();
  await setup("claude");

  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--packages", value: "" }, { flag: "--harness", value: "" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.conflicting_flags);

  await testRoot.remove();
});

test.case("update --package + positional fails with conflicting_flags", async assert => {
  await reset();
  await setup("claude");

  let threw;
  try {
    await update.run({
      subcommands: ["npm:@foo/bar"],
      flags: [{ flag: "--package", value: "npm:@baz/qux" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.conflicting_flags);

  await testRoot.remove();
});

test.case("update <source> not installed fails with package_not_found", async assert => {
  await reset();
  await setup("claude");

  let threw;
  try {
    await update.run({
      subcommands: ["https://github.com/nonexistent/pkg"],
      flags: [],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    assert(e instanceof CodeError).true();
    threw = (e as CodeError).code;
  }
  assert(threw).equals(UpdateErrorCode.package_not_found);

  await testRoot.remove();
});

test.case("update --packages updates git packages", async assert => {
  await reset();
  await setup("claude");

  // Create a "remote" git repo with v1.0.0
  const remoteDir = testRoot.append("/remote-repo");
  await createRemoteRepo(remoteDir, "1.0.0", "init");

  // Clone into the global git store
  const gitStore = testRoot.append(
    `/${MAIN_FOLDER}/git/localhost/test/remote-repo`,
  );
  await fs.create(gitStore.directory);
  await io.run(`git clone "${remoteDir.path}" "${gitStore.path}"`);

  // Register in global config
  await writeGlobalConfig(
    { packages: ["https://localhost/test/remote-repo"] },
    testRoot.path,
  );

  // Add a new commit to the remote with v2.0.0
  await remoteDir.append("/package.json").write(
    JSON.stringify({
      name: "test-pkg",
      version: "2.0.0",
      description: "test",
      keywords: ["powerups-package"],
      powerups: { active: { "multi-use": {}, "single-use": {} } },
    }),
  );
  await io.run("git add -A", { cwd: remoteDir.path });
  await io.run("git commit -m v2", { cwd: remoteDir.path });

  // Run update --packages
  await update.run({
    subcommands: [],
    flags: [{ flag: "--packages", value: "" }],
    context: { homeDir: testRoot.path },
  });

  // Verify the clone was updated
  const pkg = JSON.parse(await gitStore.append("/package.json").text());
  assert(pkg.version).equals("2.0.0");

  await testRoot.remove();
});

test.case("update --packages continues on failure", async assert => {
  await reset();
  await setup("claude");

  // Create one valid git repo
  const remoteDir = testRoot.append("/remote-repo-valid");
  await createRemoteRepo(remoteDir, "1.0.0", "init");

  const validGitStore = testRoot.append(
    `/${MAIN_FOLDER}/git/localhost/test/remote-repo-valid`,
  );
  await fs.create(validGitStore.directory);
  await io.run(`git clone "${remoteDir.path}" "${validGitStore.path}"`);

  // Register both in global config — the broken repo is NOT cloned,
  // so updateGitPackage will fail with "repository not found"
  await writeGlobalConfig(
    {
      packages: [
        "https://localhost/test/remote-repo-valid",
        "https://localhost/test/broken-repo",
      ],
    },
    testRoot.path,
  );

  // Add a new commit to the valid remote
  await remoteDir.append("/package.json").write(
    JSON.stringify({
      name: "test-pkg",
      version: "2.0.0",
      description: "test",
      keywords: ["powerups-package"],
      powerups: { active: { "multi-use": {}, "single-use": {} } },
    }),
  );
  await io.run("git add -A", { cwd: remoteDir.path });
  await io.run("git commit -m v2", { cwd: remoteDir.path });

  // Run update --packages — should continue despite the broken repo
  let threw;
  try {
    await update.run({
      subcommands: [],
      flags: [{ flag: "--packages", value: "" }],
      context: { homeDir: testRoot.path },
    });
  } catch (e: unknown) {
    threw = e;
  }

  // Should have thrown because one package failed
  assert(threw).defined();

  // The valid one should have been updated
  const pkg = JSON.parse(
    await validGitStore.append("/package.json").text(),
  );
  assert(pkg.version).equals("2.0.0");

  await testRoot.remove();
});

test.case("update <source> updates one git package", async assert => {
  await reset();
  await setup("claude");

  // Create a "remote" git repo with v1.0.0
  const remoteDir = testRoot.append("/remote-repo");
  await createRemoteRepo(remoteDir, "1.0.0", "init");

  // Clone into the global git store
  const gitStore = testRoot.append(
    `/${MAIN_FOLDER}/git/localhost/test/remote-repo`,
  );
  await fs.create(gitStore.directory);
  await io.run(`git clone "${remoteDir.path}" "${gitStore.path}"`);

  // Add a new commit to the remote with v2.0.0
  await remoteDir.append("/package.json").write(
    JSON.stringify({
      name: "test-pkg",
      version: "2.0.0",
      description: "test",
      keywords: ["powerups-package"],
      powerups: { active: { "multi-use": {}, "single-use": {} } },
    }),
  );
  await io.run("git add -A", { cwd: remoteDir.path });
  await io.run("git commit -m v2", { cwd: remoteDir.path });

  // Run update with positional source
  await update.run({
    subcommands: ["https://localhost/test/remote-repo"],
    flags: [],
    context: { homeDir: testRoot.path },
  });

  // Verify the clone was updated
  const pkg = JSON.parse(await gitStore.append("/package.json").text());
  assert(pkg.version).equals("2.0.0");

  await testRoot.remove();
});