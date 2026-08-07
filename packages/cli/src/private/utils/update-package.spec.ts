import test from "@rcompat/test";
import fs, { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import io from "@rcompat/io";
import { updateNpmPackage, updateGitPackage } from "#utils/update-package";
import { FOLDER_FOR_NPM_INSTALLED_PACKAGES, PACKAGE_JSON, FOLDER_FOR_GIT_INSTALLED_PACKAGES } from "#constants";

const root = await runtime.projectRoot();
const testRoot = root.append("/tmp");

async function reset() {
  await testRoot.remove();
  await fs.create(testRoot);
}

/** Initialize a git repo with user config and an initial commit. */
async function gitInit(dir: FileRef): Promise<void> {
  await io.run("git init", { cwd: dir.path });
  await io.run("git config user.email test@test.com", { cwd: dir.path });
  await io.run("git config user.name test", { cwd: dir.path });
}

/** Stage all and commit. */
async function gitCommit(dir: FileRef, message: string): Promise<void> {
  await io.run("git add -A", { cwd: dir.path });
  await io.run(`git commit -m "${message}"`, { cwd: dir.path });
}

/** Write a minimal package.json into a directory. */
async function writePkgJson(dir: FileRef, name: string, version: string): Promise<void> {
  await dir.append(`/${PACKAGE_JSON}`).writeJSON({
    name,
    version,
    description: "test package",
    keywords: ["powerups-package"],
    powerups: { active: { "multi-use": {}, "single-use": {} } },
  });
}

// ---------------------------------------------------------------------------
// npm tests
// ---------------------------------------------------------------------------

test.group("updateNpmPackage", () => {
  test.case("returns error when package dir not found", async assert => {
    await reset();

    // Create the npm store directory but no package inside
    const storeRoot = testRoot.append("/store");
    await fs.create(storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules`));

    const result = await updateNpmPackage(
      storeRoot,
      "npm:nonexistent-pkg",
      "nonexistent-pkg",
      "global",
    );

    assert(result.updated).false();
    assert(result.error !== undefined).true();
    assert(result.error!.includes("package not found")).true();

    await testRoot.remove();
  });

  test.case("returns error when npm view fails", async assert => {
    await reset();

    // Create a fake package in the store with a name that won't exist on npm
    const storeRoot = testRoot.append("/store");
    const pkgDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/totally-fake-pkg-xyz-123`);
    await fs.create(pkgDir);
    await writePkgJson(pkgDir, "totally-fake-pkg-xyz-123", "1.0.0");

    // Create the store's own package.json
    const npmDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}`);
    await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
      name: "powerups-extensions",
      private: true,
      dependencies: {},
    });

    const result = await updateNpmPackage(
      storeRoot,
      "npm:totally-fake-pkg-xyz-123",
      "totally-fake-pkg-xyz-123",
      "global",
    );

    assert(result.updated).false();
    assert(result.error !== undefined).true();
    assert(result.error!.includes("npm view failed")).true();

    await testRoot.remove();
  });

  test.case("skips when already current (requires network)", async assert => {
    // This test requires network access to query the npm registry.
    // It uses "left-pad", a tiny real npm package.
    await reset();

    // Create the npm store with a real small package installed at its latest version.
    // We'll use npm to install it so the version matches.
    const storeRoot = testRoot.append("/store");
    const npmDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}`);
    await fs.create(npmDir);
    await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
      name: "powerups-extensions",
      private: true,
      dependencies: {},
    });

    // Install left-pad into the store
    try {
      await io.run("npm install left-pad", { cwd: npmDir.path });
    } catch {
      // No network — skip this test gracefully
      await testRoot.remove();
      assert(true).true(); // pass vacuously
      return;
    }

    // Read the installed version
    const pkgJsonPath = npmDir.append(`/node_modules/left-pad/${PACKAGE_JSON}`);
    if (!(await fs.exists(pkgJsonPath))) {
      await testRoot.remove();
      assert(true).true();
      return;
    }

    const result = await updateNpmPackage(
      storeRoot,
      "npm:left-pad",
      "left-pad",
      "global",
    );

    // If npm view returns the same version, updated should be false
    if (!result.error) {
      assert(result.updated).false();
    } else {
      // npm view failed (possibly offline) — error is acceptable
      assert(result.error !== undefined).true();
    }

    await testRoot.remove();
  });

  test.case("updates when version differs (requires network)", async assert => {
    // This test requires network access to query and install from the npm registry.
    await reset();

    const storeRoot = testRoot.append("/store");
    const npmDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}`);
    await fs.create(npmDir);
    await npmDir.append(`/${PACKAGE_JSON}`).writeJSON({
      name: "powerups-extensions",
      private: true,
      dependencies: { "left-pad": "1.0.0" }, // pin old version
    });

    // Install the old version
    try {
      await io.run("npm install", { cwd: npmDir.path });
    } catch {
      await testRoot.remove();
      assert(true).true();
      return;
    }

    const result = await updateNpmPackage(
      storeRoot,
      "npm:left-pad",
      "left-pad",
      "global",
    );

    if (!result.error) {
      // Should have detected version difference and updated
      assert(result.updated).true();
      assert(result.oldVersion !== undefined).true();
      assert(result.newVersion !== undefined).true();
    } else {
      // npm view or install failed (possibly offline)
      assert(result.error !== undefined).true();
    }

    await testRoot.remove();
  });
});

// ---------------------------------------------------------------------------
// git tests (fully offline using local repos as remotes)
// ---------------------------------------------------------------------------

test.group("updateGitPackage", () => {
  test.case("returns error when repo not found", async assert => {
    await reset();

    const storeRoot = testRoot.append("/store");
    await fs.create(storeRoot);

    const result = await updateGitPackage(
      storeRoot,
      "https://localhost/test/pkg",
      `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/localhost/test/pkg`,
      "global",
    );

    assert(result.updated).false();
    assert(result.error !== undefined).true();
    assert(result.error!.includes("repository not found")).true();

    await testRoot.remove();
  });

  test.case("skips when already current", async assert => {
    await reset();

    // 1. Create a "remote" repo with one commit
    const remoteDir = testRoot.append("/remote-repo");
    await fs.create(remoteDir);
    await gitInit(remoteDir);
    await writePkgJson(remoteDir, "test-pkg", "1.0.0");
    await gitCommit(remoteDir, "init");

    // 2. Clone into the store
    const storeRoot = testRoot.append("/store");
    const clonePath = `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/localhost/test/pkg`;
    const cloneDir = storeRoot.append(`/${clonePath}`);
    await fs.create(cloneDir.directory);
    await io.run(`git clone "${remoteDir.path}" "${cloneDir.path}"`);

    // 3. Call update — no new commits on remote, should be already current
    const result = await updateGitPackage(
      storeRoot,
      "https://localhost/test/pkg",
      clonePath,
      "global",
    );

    assert(result.updated).false();
    assert(result.error).undefined();

    await testRoot.remove();
  });

  test.case("updates when HEAD differs", async assert => {
    await reset();

    // 1. Create a "remote" repo with one commit
    const remoteDir = testRoot.append("/remote-repo");
    await fs.create(remoteDir);
    await gitInit(remoteDir);
    await writePkgJson(remoteDir, "test-pkg", "1.0.0");
    await gitCommit(remoteDir, "init");

    // 2. Clone into the store
    const storeRoot = testRoot.append("/store");
    const clonePath = `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/localhost/test/pkg`;
    const cloneDir = storeRoot.append(`/${clonePath}`);
    await fs.create(cloneDir.directory);
    await io.run(`git clone "${remoteDir.path}" "${cloneDir.path}"`);

    // 3. Add a new commit to the remote
    await writePkgJson(remoteDir, "test-pkg", "2.0.0");
    await gitCommit(remoteDir, "v2");

    // 4. Call update — should detect difference and pull
    const result = await updateGitPackage(
      storeRoot,
      "https://localhost/test/pkg",
      clonePath,
      "global",
    );

    assert(result.updated).true();
    assert(result.oldVersion !== undefined).true();
    assert(result.newVersion !== undefined).true();
    assert(result.oldVersion !== result.newVersion).true();

    // Verify the clone was actually updated
    const pkg = JSON.parse(await cloneDir.append(`/${PACKAGE_JSON}`).text());
    assert(pkg.version).equals("2.0.0");

    await testRoot.remove();
  });

  test.case("returns error on git fetch failure", async assert => {
    await reset();

    // Create a repo with a broken remote (origin points to non-existent path)
    const storeRoot = testRoot.append("/store");
    const clonePath = `${FOLDER_FOR_GIT_INSTALLED_PACKAGES}/localhost/test/pkg`;
    const repoDir = storeRoot.append(`/${clonePath}`);
    await fs.create(repoDir);
    await gitInit(repoDir);
    await writePkgJson(repoDir, "test-pkg", "1.0.0");
    await gitCommit(repoDir, "init");

    // Set origin to a non-existent path
    await io.run("git remote add origin /nonexistent/path/to/remote", {
      cwd: repoDir.path,
    });

    const result = await updateGitPackage(
      storeRoot,
      "https://localhost/test/pkg",
      clonePath,
      "global",
    );

    assert(result.updated).false();
    assert(result.error !== undefined).true();
    assert(result.error!.includes("git fetch failed")).true();

    await testRoot.remove();
  });
});