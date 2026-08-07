import fs, { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import {
  FOLDER_FOR_NPM_INSTALLED_PACKAGES,
  PACKAGE_JSON,
} from "#constants";

/**
 * Result of a package update attempt.
 * - `updated: true` means a new version was pulled/installed.
 * - `updated: false` with no `error` means already current.
 * - `updated: false` with `error` means the update failed.
 */
export interface UpdateResult {
  source: string;
  location: "local" | "global";
  storeType: "npm" | "git";
  updated: boolean;
  oldVersion?: string;
  newVersion?: string;
  error?: string;
}

/**
 * Update an npm package in the store.
 * Checks the installed version against the latest on npm, and only
 * runs npm install if they differ.
 */
export async function updateNpmPackage(
  storeRoot: FileRef,
  source: string,
  packageName: string,
  location: "local" | "global",
): Promise<UpdateResult> {
  try {
    // 1. Read installed version
    const pkgDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}/node_modules/${packageName}`);
    const pkgJsonPath = pkgDir.append(`/${PACKAGE_JSON}`);

    if (!(await fs.exists(pkgJsonPath))) {
      return {
        source, location, storeType: "npm",
        updated: false,
        error: `package not found at ${pkgJsonPath.path}`,
      };
    }

    const installedPkg = await pkgJsonPath.json() as Record<string, any>;
    const installedVersion = installedPkg.version;

    // 2. Query npm registry for latest version
    let latestVersion: string;
    try {
      const stdout = await io.run(`npm view ${packageName} version`);
      latestVersion = stdout.trim();
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "npm",
        updated: false,
        error: `npm view failed: ${message}`,
      };
    }

    // 3. Already current?
    if (installedVersion === latestVersion) {
      return {
        source, location, storeType: "npm",
        updated: false,
      };
    }

    // 4. Update: set dep to latest and run npm install
    const npmDir = storeRoot.append(`/${FOLDER_FOR_NPM_INSTALLED_PACKAGES}`);
    const storePkgJsonPath = npmDir.append(`/${PACKAGE_JSON}`);
    const storePkgJson = await storePkgJsonPath.json() as Record<string, any>;

    if (!storePkgJson.dependencies) {
      storePkgJson.dependencies = {};
    }
    storePkgJson.dependencies[packageName] = "latest";
    await storePkgJsonPath.writeJSON(storePkgJson);

    try {
      await io.run("npm install", { cwd: npmDir.path });
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "npm",
        updated: false,
        error: `npm install failed: ${message}`,
      };
    }

    // 5. Re-read to confirm new version
    const updatedPkg = await pkgJsonPath.json() as Record<string, any>;
    const newVersion = updatedPkg.version;

    return {
      source, location, storeType: "npm",
      updated: true,
      oldVersion: installedVersion,
      newVersion,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      source, location, storeType: "npm",
      updated: false,
      error: message,
    };
  }
}

/**
 * Update a git package in the store.
 * Checks local HEAD against remote FETCH_HEAD, and only pulls if they differ.
 */
export async function updateGitPackage(
  storeRoot: FileRef,
  source: string,
  storePath: string,
  location: "local" | "global",
): Promise<UpdateResult> {
  const targetDir = storeRoot.append(`/${storePath}`);

  try {
    if (!(await fs.exists(targetDir))) {
      return {
        source, location, storeType: "git",
        updated: false,
        error: `repository not found at ${targetDir.path}`,
      };
    }

    // 1. Get local HEAD
    let localHead: string;
    try {
      localHead = (await io.run("git rev-parse HEAD", { cwd: targetDir.path })).trim();
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "git",
        updated: false,
        error: `git rev-parse HEAD failed: ${message}`,
      };
    }

    // 2. Fetch remote
    try {
      await io.run("git fetch", { cwd: targetDir.path });
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "git",
        updated: false,
        error: `git fetch failed: ${message}`,
      };
    }

    // 3. Get remote HEAD (FETCH_HEAD)
    let remoteHead: string;
    try {
      remoteHead = (await io.run("git rev-parse FETCH_HEAD", { cwd: targetDir.path })).trim();
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "git",
        updated: false,
        error: `git rev-parse FETCH_HEAD failed: ${message}`,
      };
    }

    // 4. Already current?
    if (localHead === remoteHead) {
      return {
        source, location, storeType: "git",
        updated: false,
      };
    }

    // 5. Pull to update
    try {
      await io.run("git pull", { cwd: targetDir.path });
    } catch (e: unknown) {
      const message = typeof e === "string" ? e : String(e);
      return {
        source, location, storeType: "git",
        updated: false,
        error: `git pull failed: ${message}`,
      };
    }

    // 6. Report commit SHA diff
    return {
      source, location, storeType: "git",
      updated: true,
      oldVersion: localHead.slice(0, 7),
      newVersion: remoteHead.slice(0, 7),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      source, location, storeType: "git",
      updated: false,
      error: message,
    };
  }
}