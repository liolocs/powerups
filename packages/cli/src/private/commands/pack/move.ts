import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import { packageJsonSchema } from "#schemas/package";
import { addPackageToGlobalConfig, removePackageFromConfig } from "#utils/config";
import { validateMoveArgs, resolveMovePaths } from "#utils/move/validate";
import { collectAllSubPowerUps } from "#utils/move/collect";
import { copyActiveStructure, copySubPowerUps } from "#utils/move/copy";
import { buildUpdatedPowerups, buildGlobalPackageJson } from "#utils/move/build";
import { printMoveResult } from "#utils/move/print";
import { SRC_FOLDER, ACTIVE_FOLDER, PACKAGE_FILE, CLI_NAME } from "#constants";

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
    // 1. Validate arguments
    const packageName = validateMoveArgs(subcommands);

    // 2. Resolve and check source / destination paths
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const { localPackageDir, globalPackageDir } = await resolveMovePaths({
      root,
      packageName,
    });

    // 3. Read the local package.json
    const localPkgJson = packageJsonSchema.parse(
      await localPackageDir.append(`/${PACKAGE_FILE}`).json(),
    );

    // 4. Collect all sub-powerups referenced by this package
    const collected = await collectAllSubPowerUps({
      root,
      localPkgJson,
      localPackageDir,
    });

    // 5. Create global package dir and copy src/active structure
    await fs.create(globalPackageDir);
    const srcActiveDir = localPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    const destSrcActiveDir = globalPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    await copyActiveStructure({ srcActiveDir, destSrcActiveDir });

    // 6. Copy collected sub-powerups into the destination
    await copySubPowerUps({ collected, destSrcActiveDir });

    // 7. Build and write the global package.json with parent:child entries
    const activeRecord =
      localPkgJson[CLI_NAME].active as Record<string, Record<string, string>>;
    const updatedPowerups = buildUpdatedPowerups({ activeRecord, collected });
    const globalPkgJson = buildGlobalPackageJson({ localPkgJson, updatedPowerups });
    await globalPackageDir
      .append(`/${PACKAGE_FILE}`)
      .writeJSON(globalPkgJson as never);

    // 8. Register in global config
    await addPackageToGlobalConfig(packageName);

    // 9. Optionally remove from project config
    const shouldDelete = is.truthy(flags.delete);
    if (shouldDelete) {
      await removePackageFromConfig(root, packageName);
    }

    // 10. Print result
    printMoveResult({ packageName, globalPackageDir, collected, shouldDelete });
  },
});

export default packMove;