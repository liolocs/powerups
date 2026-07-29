import fs, { type FileRef } from "@rcompat/fs";
import pack_errors from "#errors/packErrors";
import { PACKAGE_FILE } from "#constants";

type VerifyMoveSuccessParams = {
  packageName: string;
  globalPackageDir: FileRef;
};

/**
 * Verify that a move operation successfully placed all expected content
 * in the global destination before the source is removed.
 *
 * Throws `move_verification_failed` (a coded error) if any check fails,
 * so the caller knows NOT to delete the source.
 */
export async function verifyMoveSuccess({
  packageName,
  globalPackageDir,
}: VerifyMoveSuccessParams): Promise<void> {
  // 1. Global package directory exists
  if (!(await fs.exists(globalPackageDir))) {
    throw pack_errors.move_verification_failed(
      packageName,
      "global package directory is missing",
    );
  }

  // 2. package.json exists and is readable JSON
  const globalPkgFile = globalPackageDir.append(`/${PACKAGE_FILE}`);
  if (!(await fs.exists(globalPkgFile))) {
    throw pack_errors.move_verification_failed(
      packageName,
      "global package.json is missing",
    );
  }
  try {
    await globalPkgFile.json();
  } catch {
    throw pack_errors.move_verification_failed(
      packageName,
      "global package.json is not valid JSON",
    );
  }
}