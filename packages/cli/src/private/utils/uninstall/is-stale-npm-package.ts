import fs, { type FileRef } from "@rcompat/fs";
import { INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

/**
 * Whether `parsedSource` refers to a package present in the npm store's shared
 * `package.json` but not registered in the powerups config — i.e. a stale
 * dependency left behind by a previous failed install (a failed `npm install`
 * records the dependency before resolving it, and a 404'd entry is never
 * registered in config). Only `npm:` sources can be stale this way.
 */
export default async function isStaleNpmPackage(
  powerupDir: FileRef,
  parsedSource: ParsedSource,
): Promise<boolean> {
  if (parsedSource.type !== "npm") {
    return false;
  }

  const packageName = parsedSource.configEntry.slice(4);
  const pkgJsonPath = powerupDir.append(`/${INSTALLED_FOLDER.npm}/${PACKAGE_JSON}`);

  if (!(await fs.exists(pkgJsonPath))) {
    return false;
  }

  const pkgJson = await pkgJsonPath.json() as Record<string, any>;
  return pkgJson.dependencies?.[packageName] !== undefined;
}