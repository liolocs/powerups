import fs, { type FileRef } from "@rcompat/fs";
import {
  MAIN_FOLDER,
  ACTIVE_FOLDER,
  powerFolderMap,
  type PowerType,
} from "#constants";
import power_errors from "#errors/powerErrors";

export interface ResolvedPower {
  type: PowerType;
  folder: FileRef;
}

/**
 * Find a power by name across both multi-use and single-use folders.
 *
 * - When `type` is provided, looks only in that folder (no ambiguity check).
 * - When no `type`, searches both folders; throws ambiguity error if found
 *   in both.
 * - Throws not-found if the power doesn't exist in the searched folder(s).
 */
export async function resolvePower(
  root: FileRef,
  name: string,
  type?: PowerType,
): Promise<ResolvedPower> {
  const activeFolder = root.append(`/${MAIN_FOLDER}/${ACTIVE_FOLDER}`);

  // If type is provided, look only in that folder
  if (type !== undefined) {
    const folder = activeFolder.append(`/${powerFolderMap[type]}/${name}`);
    if (await fs.exists(folder)) {
      return { type, folder };
    }
    throw power_errors.not_found(name);
  }

  // Search both folders
  const types: PowerType[] = ["multi-use", "single-use"];
  const found: ResolvedPower[] = [];

  for (const t of types) {
    const folder = activeFolder.append(`/${powerFolderMap[t]}/${name}`);
    if (await fs.exists(folder)) {
      found.push({ type: t, folder });
    }
  }

  if (found.length === 0) {
    throw power_errors.not_found(name);
  }

  if (found.length > 1) {
    throw power_errors.ambiguous(name);
  }

  return found[0];
}