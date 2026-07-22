import fs, { type FileRef } from "@rcompat/fs";
import { MULTI_USE_FOLDER, SINGLE_USE_FOLDER } from "#constants";
import type { CollectedSubPowerUp } from "#utils/move/collect";

type CopyActiveStructureParams = {
  srcActiveDir: FileRef;
  destSrcActiveDir: FileRef;
};

/**
 * Copy the `src/active/` tree (multi-use + single-use folders and every
 * powerup directory inside them) from source to destination.
 *
 * Uses `FileRef.copy()` for recursive directory copying so that nested
 * sub-folders and their files are preserved.
 */
export async function copyActiveStructure({
  srcActiveDir,
  destSrcActiveDir,
}: CopyActiveStructureParams): Promise<void> {
  await fs.create(destSrcActiveDir);

  for (const typeFolder of [MULTI_USE_FOLDER, SINGLE_USE_FOLDER]) {
    const srcTypeDir = srcActiveDir.append(`/${typeFolder}`);
    if (await fs.exists(srcTypeDir)) {
      const destTypeDir = destSrcActiveDir.append(`/${typeFolder}`);

      // FIX: use dirs() — powerup entries are directories, not files.
      const powerDirs = await srcTypeDir.dirs();
      for (const powerDir of powerDirs) {
        // FIX: use built-in copy() for recursive copy of instructions.json
        //      + template/ (including nested sub-folders and their files).
        await powerDir.copy(destTypeDir.append(`/${powerDir.name}`));
      }
    }
  }
}

type CopySubPowerUpsParams = {
  collected: Map<string, CollectedSubPowerUp>;
  destSrcActiveDir: FileRef;
};

/**
 * Copy each collected sub-powerup folder into the correct type directory
 * under the destination `src/active/` tree, skipping any that already exist.
 */
export async function copySubPowerUps({
  collected,
  destSrcActiveDir,
}: CopySubPowerUpsParams): Promise<void> {
  for (const [subName, info] of collected) {
    const typeFolder = info.type === "multi-use"
      ? MULTI_USE_FOLDER
      : SINGLE_USE_FOLDER;
    const destPowerDir = destSrcActiveDir.append(`/${typeFolder}/${subName}`);

    if (!(await fs.exists(destPowerDir))) {
      await info.folder.copy(destPowerDir);
    }
  }
}