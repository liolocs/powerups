import { type FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import path from "node:path";
import { homedir } from "node:os";
import { SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import parseSource from "#utils/install/parse-source/index";
import checkSourceWasPassed from "#utils/install/check-for-pre-install-errors/check-source-was-passed";
import checkNotInternal from "#utils/install/check-for-pre-install-errors/check-not-internal";
import checkPowerupNameNotAlreadyInstalled from "#utils/install/check-for-pre-install-errors/check-powerup-name-not-already-installed";
import setupPowerupDir from "#utils/install/setup-powerup-dir";
import fetchPackage from "#utils/install/fetch-package/index";
import validateInstalledPackage from "#utils/install/validate-installed-package";
import registerPowerup from "#utils/shared/register-powerup";
import printInstallSummary from "#utils/install/print-install-summary";

const dryRunFlag: Flag = {
  name: "dryRun",
  long: "dry-run",
  short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

const localFlag = {
  name: "local",
  long: "local",
  short: "l",
  description: "Install to local project store instead of global",
  type: "boolean",
} as const satisfies Flag;

const install = new Command({
  name: "install",

  description: `Install a ${SINGULAR_NAME_FOR_CLI} locally or globally`,

  flags: [dryRunFlag, localFlag],

  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? runtime.cwd();
    const isDryRun = flags.dryRun === true;
    const isLocal = flags.local === true;
    const homeDir = context?.homeDir ?? homedir();

    const source = subcommands?.[0];
    checkSourceWasPassed(source);

    const parsedSource = parseSource(source!);

    await checkNotInternal({
      parsedType: parsedSource.type,
      name: source!,
      homeDir,
    });

    if (!isDryRun) {
      const { powerupDir } = await setupPowerupDir({
        isLocal,
        projectRoot,
        homeDir,
      });

      await fetchPackage({ powerupDir, parsedSource });

      const packageDir = powerupDir.append(`/${parsedSource.storePath}`);
      await validateInstalledPackage({ packageDir, source: parsedSource.configEntry });

      const instructions = await packageDir.append("/dist/instructions.json").json() as { name: string };

      await checkPowerupNameNotAlreadyInstalled({
        powerupName: instructions.name,
        isLocal,
        projectRoot,
        homeDir,
      });

      await registerPowerup({
        configEntry: parsedSource.configEntry,
        powerupName: instructions.name,
        isLocal,
        projectRoot,
        homeDir,
      });
    }

    const installedPath = isLocal
      ? projectRoot.append(`/${CLI_FOLDER_NAME}/${parsedSource.storePath}`).path
      : path.join(homeDir, CLI_FOLDER_NAME, parsedSource.storePath);

    printInstallSummary({
      source: parsedSource.configEntry,
      isLocal,
      storeType: parsedSource.type,
      isDryRun,
      installedPath,
    });
  },
});

export default install;