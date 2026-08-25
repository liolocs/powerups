import { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import path from "node:path";
import { homedir } from "node:os";
import fs from "@rcompat/fs";
import { SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, CONFIG_FILE_NAME } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import { getPackageSource, removePackageFromConfig, removePackageFromGlobalConfig } from "#utils/config";
import parseSource from "#utils/install/parse-source/index";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";
import checkNameWasPassed from "#utils/uninstall/check-for-pre-uninstall-errors/check-name-was-passed";
import checkNotInternal from "#utils/uninstall/check-for-pre-uninstall-errors/check-not-internal";
import removeInstallDirectory from "#utils/uninstall/remove-install-directory";
import printUninstallSummary from "#utils/uninstall/print-uninstall-summary";
import uninstall_errors from "#errors/uninstallErrors";

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

    if (powerupPackageEntry === null) {
      throw uninstall_errors.not_installed(powerupName!);
    }

    const source = getPackageSource(powerupPackageEntry);
    const parsedSource = parseSource(source);

    checkNotInternal({ parsedType: parsedSource.type, name: powerupName! });

    const powerupDir = isLocal
      ? projectRoot.append(`/${CLI_FOLDER_NAME}`)
      : fs.ref(path.join(homeDir, CLI_FOLDER_NAME));

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

export default uninstall;