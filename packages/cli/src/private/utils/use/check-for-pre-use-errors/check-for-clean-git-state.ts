import io from "@rcompat/io";
import use_errors from "#errors/useErrors";
import { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";

export default async function checkForCleanGitState(cwd: FileRef): Promise<void> {
  let status: string;
  try {
    status = await io.run("git status --porcelain", { cwd: cwd.path });
  } catch {
    // its fine if there is no git repo
  }

  // @ts-expect-error doesn't recognize the is.defined check
  if (is.defined(status) && status.trim().length > 0) {
    throw use_errors.working_tree_dirty();
  }
}