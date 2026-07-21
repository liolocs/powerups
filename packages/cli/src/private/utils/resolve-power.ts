import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { readConfig } from "#utils/config";
import { packageJsonSchema, type PowersProperty } from "#schemas/package";
import power_errors from "#errors/powerErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  GLOBAL_INTERNAL_PATH,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  type PowerType,
} from "#constants";

export interface ResolvedPower {
  type: PowerType;
  folder: FileRef;
  packageName: string;
  location: "local" | "global";
}

interface PackageLocation {
  packageName: string;
  packageDir: FileRef;
  powers: PowersProperty;
  location: "local" | "global";
}

/**
 * Resolve a package by name, checking local first then global.
 * Returns null if the package doesn't exist in either location.
 */
async function resolvePackage(
  projectRoot: FileRef,
  packageName: string,
): Promise<PackageLocation | null> {
  // Check local first
  const localDir = projectRoot.append(
    `/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`,
  );
  if (await fs.exists(localDir)) {
    const pkgJsonPath = localDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return {
        packageName,
        packageDir: localDir,
        powers: pkgJson.powers,
        location: "local",
      };
    }
  }

  // Check global
  const globalDir = fs.ref(`${GLOBAL_INTERNAL_PATH}/${packageName}`);
  if (await fs.exists(globalDir)) {
    const pkgJsonPath = globalDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return {
        packageName,
        packageDir: globalDir,
        powers: pkgJson.powers,
        location: "global",
      };
    }
  }

  return null;
}

/**
 * Find a power by name across all config-listed packages.
 *
 * - Reads the project config's packages array
 * - For each package, resolves its location (local first, then global)
 * - Searches the package's powers property for the requested power name
 * - Local packages are prioritized over global on name collision
 * - Throws not_found if the power doesn't exist in any config-listed package
 * - Throws ambiguous if the same power name is found in multiple local packages
 */
export async function resolvePower(
  root: FileRef,
  name: string,
  type?: PowerType,
): Promise<ResolvedPower> {
  const config = await readConfig(root);

  if (config === null) {
    throw power_errors.not_found(name);
  }

  const matches: ResolvedPower[] = [];

  for (const packageName of config.packages) {
    const pkgLoc = await resolvePackage(root, packageName);
    if (pkgLoc === null) continue;

    const active = pkgLoc.powers.active;

    // Determine which types to search
    const typesToSearch: PowerType[] = type
      ? [type]
      : ["multi-use", "single-use"];

    for (const t of typesToSearch) {
      const typeFolder = t === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
      const powersMap = active[typeFolder as keyof typeof active];

      if (is.defined(powersMap)) {
        // Look for exact power name match (not parent:child entries)
        if (is.defined(powersMap[name])) {
          const instructionPath = powersMap[name][0];
          const powerFolder = pkgLoc.packageDir.append(
            `/${instructionPath}`,
          ).directory;

          matches.push({
            type: t,
            folder: powerFolder,
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
    // Multiple local packages have the same power name
    throw power_errors.ambiguous(name);
  }

  // Multiple global matches — also ambiguous
  throw power_errors.ambiguous(name);
}