import { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import path from "node:path";
import { homedir } from "node:os";
import fs from "@rcompat/fs";
import { SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, CONFIG_FILE_NAME, INSTALLED_FOLDER, PACKAGE_JSON } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import { getPackageSource, removePackageFromConfig, removePackageFromGlobalConfig } from "#utils/config";
import parseSource from "#utils/install/parse-source/index";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";
import checkNameWasPassed from "#utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed";
import checkNotInternal from "#utils/uninstall/check-for-pre-uninstall-errors/check-not-internal";
import removeInstallDirectory from "#utils/uninstall/remove-install-directory";
import printUninstallSummary from "#utils/uninstall/print-uninstall-summary";
import uninstall_errors from "#errors/uninstallErrors";
import type { ParsedSource } from "#utils/install/parse-source/index";

const dryRunFlag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print what would be removed without making changes",
  type: "boolean",
} as const satisfies Flag;

const localFlag = {
  name: "local", long: "local", short: "l",
  description: "Uninstall from local project store instead of global",
  type: "boolean",
} as const satisfies Flag;

const uninstall = new Command({
  name: "uninstall",

  description: `Uninstall a ${SINGULAR_NAME_FOR_CLI}`,

  flags: [dryRunFlag, localFlag],

  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? runtime.cwd();
    const isDryRun = flags.dryRun === true;
    const isLocal = flags.local === true;
    const homeDir = context?.homeDir ?? homedir();

    const powerupName = subcommands?.[0];
    checkNameWasPassed(powerupName);

    const configRef = isLocal
      ? projectRoot.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`)
      : fs.ref(path.join(homeDir, CLI_FOLDER_NAME, CONFIG_FILE_NAME));

    const powerupPackageEntry = await findPowerupInConfig({ configRef, powerupName: powerupName! });

    const powerupDir = isLocal
      ? projectRoot.append(`/${CLI_FOLDER_NAME}`)
      : fs.ref(path.join(homeDir, CLI_FOLDER_NAME));

    // Not registered in config. If the user passed an npm source, it may be a
    // stale package left in the npm store from a previous failed install (a
    // failed `npm install` records the dependency before resolving it, and a
    // 404'd entry is never registered in config). Let the user purge it.
    if (powerupPackageEntry === null) {
      const parsedSource = parseSource(powerupName!);

      if (parsedSource.type === "npm" && await isStaleNpmPackage(powerupDir, parsedSource)) {
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
        return;
      }

      throw uninstall_errors.not_installed(powerupName!);
    }

    const source = getPackageSource(powerupPackageEntry);
    const parsedSource = parseSource(source);

    checkNotInternal({ parsedType: parsedSource.type, name: powerupName! });

    const removedPath = isLocal
      ? projectRoot.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`).path
      : path.join(homeDir, CLI_FOLDER_NAME, parsedSource.storePath);

    if (!isDryRun) {
      if (isLocal) {
        await removePackageFromConfig(projectRoot, source);
      } else {
        await removePackageFromGlobalConfig(source, homeDir);
      }

      await removeInstallDirectory({ powerupDir, parsedSource });
    }

    printUninstallSummary({
      powerupName: powerupName!,
      source: parsedSource.configEntry,
      isLocal,
      storeType: parsedSource.type,
      isDryRun,
      removedPath,
    });
  },
});

/**
 * Whether an npm source refers to a package present in the npm store's shared
 * `package.json` but not registered in the powerups config — i.e. a stale
 * dependency left behind by a previous failed install.
 */
async function isStaleNpmPackage(
  powerupDir: FileRef,
  parsedSource: ParsedSource,
): Promise<boolean> {
  const packageName = parsedSource.configEntry.slice(4);
  const pkgJsonPath = powerupDir.append(`/${INSTALLED_FOLDER.npm}/${PACKAGE_JSON}`);

  if (!(await fs.exists(pkgJsonPath))) {
    return false;
  }

  const pkgJson = await pkgJsonPath.json() as Record<string, any>;
  return pkgJson.dependencies?.[packageName] !== undefined;
}

export default uninstall;