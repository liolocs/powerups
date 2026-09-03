import path from "node:path";
import { type FileRef } from "@rcompat/fs";
import { CLI_FOLDER_NAME } from "#constants";
import removeInstallDirectory from "#utils/uninstall/remove-install-directory";
import printUninstallSummary from "#utils/uninstall/print-uninstall-summary";
import type { ParsedSource } from "#utils/install/parse-source/index";

/**
 * Remove a stale npm package from the store and report it.
 *
 * Unlike a normal uninstall, a stale package is not registered in the powerups
 * config (it never installed successfully), so only the npm store entry is
 * purged (via `npm uninstall`).
 */
export default async function removeStaleNpmPackage({
  powerupDir,
  parsedSource,
  isLocal,
  isDryRun,
  projectRoot,
  homeDir,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
  isLocal: boolean;
  isDryRun: boolean;
  projectRoot: FileRef;
  homeDir: string;
}): Promise<void> {
  const packageName = parsedSource.configEntry.slice(4);
  const removedPath = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`).path
    : path.join(homeDir, CLI_FOLDER_NAME, parsedSource.storePath);

  if (!isDryRun) {
    await removeInstallDirectory({ powerupDir, parsedSource });
  }

  printUninstallSummary({
    powerupName: packageName,
    source: parsedSource.configEntry,
    isLocal,
    storeType: parsedSource.type,
    isDryRun,
    removedPath,
  });
}