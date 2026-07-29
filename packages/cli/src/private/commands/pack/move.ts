import { ACTIVE_FOLDER, CLI_NAME, PACKAGE_FILE, SRC_FOLDER } from "#constants";
import { packageJsonSchema } from "#schemas/package";
import {
  addPackageToGlobalConfig,
  removePackageFromConfig,
} from "#utils/config";
import {
  buildGlobalPackageJson,
  buildUpdatedPowerups,
} from "#utils/move/build";
import { collectAllSubPowerUps } from "#utils/move/collect";
import { copyActiveStructure, copySubPowerUps } from "#utils/move/copy";
import { printMoveResult } from "#utils/move/print";
import { resolveMovePaths, validateMoveArgs } from "#utils/move/validate";
import { verifyMoveSuccess } from "#utils/move/verify";
import { Command } from "@liolocs/program";
import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";

const packMove = new Command({
  name: "move",
  description: "Move a local package to the global location",
  flags: [
    {
      name: "delete",
      long: "delete",
      short: "d",
      description: "Remove the package from the project config after moving",
    },
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    const packageName = validateMoveArgs(subcommands);

    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const { localPackageDir, globalPackageDir } = await resolveMovePaths({
      root,
      packageName,
    });

    const localPkgJson = packageJsonSchema.parse(
      await localPackageDir.append(`/${PACKAGE_FILE}`).json(),
    );

    const collected = await collectAllSubPowerUps({
      root,
      localPkgJson,
      localPackageDir,
    });

    await fs.create(globalPackageDir);
    const srcActiveDir = localPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    const destSrcActiveDir = globalPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    await copyActiveStructure({ srcActiveDir, destSrcActiveDir });

    await copySubPowerUps({ collected, destSrcActiveDir });

    const activeRecord =
      localPkgJson[CLI_NAME].active as Record<string, Record<string, string>>;
    const updatedPowerups = buildUpdatedPowerups({ activeRecord, collected });
    const globalPkgJson = buildGlobalPackageJson({ localPkgJson, updatedPowerups });
    await globalPackageDir
      .append(`/${PACKAGE_FILE}`)
      .writeJSON(globalPkgJson as never);

    await verifyMoveSuccess({ packageName, globalPackageDir, destSrcActiveDir });

    await localPackageDir.remove({ recursive: true });

    await addPackageToGlobalConfig(packageName);

    const shouldDelete = is.truthy(flags.delete);
    if (shouldDelete) {
      await removePackageFromConfig(root, packageName);
    }

    printMoveResult({ packageName, globalPackageDir, collected, shouldDelete });
  },
});

export default packMove;