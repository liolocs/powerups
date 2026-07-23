import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { readConfig, readGlobalConfig, normalizePackageEntry, getPackageSource, type PackageEntry } from "#utils/config";
import { parseSpecifier } from "#utils/parse-specifier";
import { packageJsonSchema, type PowerUpProperty } from "#schemas/package";
import power_errors from "#errors/powerErrors";
import {
  MAIN_FOLDER,
  GLOBAL_ROOT,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  type PowerUpType,
  CLI_NAME,
} from "#constants";

export interface ResolvedPowerUp {
  type: PowerUpType;
  folder: FileRef;
  packageName: string;
  location: "local" | "global";
}

interface PackageLocation {
  packageName: string;
  packageDir: FileRef;
  powerups: PowerUpProperty;
  location: "local" | "global";
}

/**
 * Resolve a package by its source specifier, checking local first then global.
 * The source may be `npm:<package>`, a git URL, or a bare internal name.
 * Returns null if the package doesn't exist in either location.
 *
 * The returned `packageName` is taken from the resolved package.json `name`
 * field, not the source specifier.
 */
export async function resolvePackage(
  projectRoot: FileRef,
  source: string,
): Promise<PackageLocation | null> {
  const spec = parseSpecifier(source);

  // Check local first
  const localDir = projectRoot.append(`/${MAIN_FOLDER}/${spec.storePath}`);
  if (await fs.exists(localDir)) {
    const pkgJsonPath = localDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return {
        packageName: pkgJson.name,
        packageDir: localDir,
        powerups: pkgJson[CLI_NAME],
        location: "local",
      };
    }
  }

  // Check global
  const globalDir = fs.ref(`${GLOBAL_ROOT}/${spec.storePath}`);
  if (await fs.exists(globalDir)) {
    const pkgJsonPath = globalDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return {
        packageName: pkgJson.name,
        packageDir: globalDir,
        powerups: pkgJson[CLI_NAME],
        location: "global",
      };
    }
  }

  return null;
}

/**
 * Find a powerup by name across all config-listed packages.
 *
 * - Reads the project config's packages array
 * - For each package, resolves its location (local first, then global)
 * - Searches the package's powers property for the requested powerup name
 * - Applies per-entry `powerups.include` / `powerups.exclude` filters
 * - Local packages are prioritized over global on name collision
 * - Throws not_found if the powerup doesn't exist in any config-listed package
 * - Throws ambiguous if the same powerup name is found in multiple local packages
 */
export async function resolvePowerUp(
  root: FileRef,
  name: string,
  type?: PowerUpType,
  options?: { fallbackToGlobal?: boolean; homeDir?: string },
): Promise<ResolvedPowerUp> {
  const localConfig = await readConfig(root);
  const fallbackToGlobal = options?.fallbackToGlobal ?? false;

  // Build the merged list of package entries to search
  let entries: PackageEntry[];

  if (localConfig !== null) {
    entries = [...localConfig.packages];
    if (fallbackToGlobal) {
      const globalConfig = await readGlobalConfig(options?.homeDir);
      if (globalConfig !== null) {
        // Add global packages not already in local (by source)
        const localSources = new Set(localConfig.packages.map(getPackageSource));
        for (const entry of globalConfig.packages) {
          if (!localSources.has(getPackageSource(entry))) {
            entries.push(entry);
          }
        }
      }
    }
  } else if (fallbackToGlobal) {
    const globalConfig = await readGlobalConfig(options?.homeDir);
    if (globalConfig === null) {
      throw power_errors.not_initialized();
    }
    entries = globalConfig.packages;
  } else {
    throw power_errors.not_found(name);
  }

  const matches: ResolvedPowerUp[] = [];

  for (const entry of entries) {
    const normalized = normalizePackageEntry(entry);
    const pkgLoc = await resolvePackage(root, normalized.package);
    if (pkgLoc === null) continue;

    const active = pkgLoc[CLI_NAME].active;
    const filter = normalized.powerups;

    // Determine which types to search
    const typesToSearch: PowerUpType[] = is.truthy(type)
      ? [type!]
      : ["multi-use", "single-use"];

    for (const typeToSearch of typesToSearch) {
      const typeFolder = typeToSearch === "multi-use"
        ? MULTI_USE_FOLDER
        : SINGLE_USE_FOLDER;

      const powersMap = active[typeFolder as keyof typeof active];

      if (is.defined(powersMap)) {
        // Look for exact powerup name match
        if (is.defined(powersMap[name])) {
          // Apply include filter
          if (is.defined(filter?.include) && !filter!.include!.includes(name)) {
            continue;
          }

          // Apply exclude filter
          if (is.defined(filter?.exclude) && filter!.exclude!.includes(name)) {
            continue;
          }

          const instructionPath = powersMap[name];
          const powerupsFolder = pkgLoc.packageDir.append(
            `/${instructionPath}`,
          ).directory;

          matches.push({
            type: typeToSearch,
            folder: powerupsFolder,
            packageName: pkgLoc.packageName,
            location: pkgLoc.location,
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    throw power_errors.not_found(name);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // Multiple matches — prefer local
  const localMatches = matches.filter(m => m.location === "local");

  if (localMatches.length === 1) {
    return localMatches[0];
  }

  if (localMatches.length > 1) {
    // Multiple local packages have the same powerup name
    throw power_errors.ambiguous(name);
  }

  // Multiple global matches — also ambiguous
  throw power_errors.ambiguous(name);
}