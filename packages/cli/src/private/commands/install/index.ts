import { type FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import { homedir } from "node:os";
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { Command, type Flag } from "@liolocs/program";

import parseSource from "#utils/install/parse-source/index";
import checkSourceWasPassed from "#utils/install/check-for-pre-install-errors/check-source-was-passed";
import checkNotInternal from "#utils/install/check-for-pre-install-errors/check-not-internal";
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
};

const localFlag: Flag = {
  name: "local",
  long: "local",
  short: "l",
  description: "Install to local project store instead of global",
};

const install = new Command({
  name: "install",
  description: `Install a ${SINGULAR_NAME_FOR_CLI} locally or globally`,
  flags: [dryRunFlag, localFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? runtime.cwd();
    const isDryRun = is.defined(flags.dryRun);
    const isLocal = is.defined(flags.local);

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

      await validateInstalledPackage({
        packageDir: powerupDir.append(`/${parsedSource.storePath}`),
        source: parsedSource.configEntry,
      });

      await registerPowerup({
        configEntry: parsedSource.configEntry,
        isLocal,
        projectRoot,
        homeDir,
      });
    }

    printInstallSummary({
      source: parsedSource.configEntry,
      isLocal,
      storeType: parsedSource.type,
      isDryRun,
    });
  },
});

export default install;