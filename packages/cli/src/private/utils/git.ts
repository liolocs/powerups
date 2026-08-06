import type { FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import use_errors from "#errors/useErrors";

export async function verifyGitRepo(projectRoot: FileRef): Promise<void> {
  try {
    await io.run("git rev-parse --git-dir", { cwd: projectRoot.path });
  } catch {
    throw use_errors.git_repo_required();
  }
}

/**
 * Require an empty working tree so a failed run can be reverted via
 * `git checkout --`. Throws use_errors.working_tree_dirty if
 * `git status --porcelain` produces any output.
 */
export async function ensureCleanTree(projectRoot: FileRef): Promise<void> {
  let status: string;
  try {
    status = await io.run("git status --porcelain", { cwd: projectRoot.path });
  } catch {
    throw use_errors.git_repo_required();
  }
  if (status.trim().length > 0) {
    throw use_errors.working_tree_dirty();
  }
}