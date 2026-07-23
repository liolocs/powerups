import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  NPM_STORE,
  NPM_EXTENSIONS_NAME,
  PACKAGE_FILE,
} from "#constants";

const execAsync = promisify(exec);

/**
 * Ensure the npm store exists with a valid package.json.
 * Creates the directory and initializes package.json if missing.
 */
async function ensureNpmStore(storeRoot: FileRef): Promise<FileRef> {
  const npmDir = storeRoot.append(`/${NPM_STORE}`);
  await fs.create(npmDir);

  const pkgJsonPath = npmDir.append(`/${PACKAGE_FILE}`);
  if (!(await fs.exists(pkgJsonPath))) {
    await pkgJsonPath.writeJSON({
      name: NPM_EXTENSIONS_NAME,
      private: true,
      dependencies: {},
    });
  }

  return npmDir;
}

/**
 * Install an npm package into the store.
 * Adds the package to the store's package.json dependencies, then runs npm install.
 */
export async function installNpmPackage(
  storeRoot: FileRef,
  packageName: string,
): Promise<void> {
  const npmDir = await ensureNpmStore(storeRoot);
  const pkgJsonPath = npmDir.append(`/${PACKAGE_FILE}`);
  const pkgJson = await pkgJsonPath.json() as Record<string, any>;

  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }

  // Add or update the dependency (use "latest" if no version specified)
  if (!pkgJson.dependencies[packageName]) {
    pkgJson.dependencies[packageName] = "latest";
  }

  await pkgJsonPath.writeJSON(pkgJson);

  // Run npm install in the store directory
  try {
    cli.print(`Running npm install in ${npmDir.path}...\n`);
    const stdout = await io.run("npm install", { cwd: npmDir.path });
    if (stdout) cli.print(stdout);
  } catch (error) {
    const message = typeof error === "string" ? error : String(error);
    throw new Error(`npm install failed: ${message}`, { cause: error });
  }
}

/**
 * Clone or update a git repository into the store.
 * Uses shallow clone. If already cloned, runs git pull to update.
 */
export async function installGitPackage(
  storeRoot: FileRef,
  gitUrl: string,
  storePath: string,
): Promise<void> {
  const targetDir = storeRoot.append(`/${storePath}`);

  if (await fs.exists(targetDir)) {
    // Already cloned — pull to update
    try {
      cli.print(`Updating ${gitUrl}...\n`);
      await execAsync("git pull", { cwd: targetDir.path });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`git pull failed: ${message}`, { cause: e });
    }
  } else {
    // Shallow clone
    try {
      cli.print(`Cloning ${gitUrl}...\n`);
      await fs.create(targetDir.directory);
      await execAsync(`git clone --depth 1 "${gitUrl}" "${targetDir.path}"`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`git clone failed: ${message}`, { cause: e });
    }
  }
}