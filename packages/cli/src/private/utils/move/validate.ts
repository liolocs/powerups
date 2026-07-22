import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import pack_errors from "#errors/packErrors";
import { MAIN_FOLDER, INTERNAL_FOLDER, GLOBAL_INTERNAL_PATH } from "#constants";

/**
 * Validate the `pack move` subcommand arguments.
 *
 * Returns the package name if valid, otherwise throws.
 *
 * **Pure** (modulo error throwing).
 */
export function validateMoveArgs(subcommands: string[] | undefined): string {
  const packageName = subcommands?.[0];
  const destination = subcommands?.[1];

  if (!is.defined(packageName)) {
    throw pack_errors.invalid_package_name("");
  }

  if (destination !== "global") {
    throw pack_errors.invalid_move_destination(destination ?? "");
  }

  return packageName;
}

type ResolveMovePathsParams = {
  root: FileRef;
  packageName: string;
};

/**
 * Resolve the local and global package directories for a move operation.
 *
 * Checks that the source exists and the destination does not.
 * Returns both directories on success, otherwise throws.
 */
export async function resolveMovePaths({
  root,
  packageName,
}: ResolveMovePathsParams): Promise<{ localPackageDir: FileRef; globalPackageDir: FileRef }> {
  const localPackageDir = root.append(
    `/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`,
  );

  if (!(await fs.exists(localPackageDir))) {
    throw pack_errors.package_not_found(packageName);
  }

  const globalPackageDir = fs.ref(`${GLOBAL_INTERNAL_PATH}/${packageName}`);
  if (await fs.exists(globalPackageDir)) {
    throw pack_errors.global_destination_exists(packageName);
  }

  return { localPackageDir, globalPackageDir };
}