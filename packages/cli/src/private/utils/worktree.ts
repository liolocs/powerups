import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import fs, { type FileRef } from "@rcompat/fs";
import path from "node:path";
import io from "@rcompat/io";

export interface ChangedFile {
  worktreePath: string; // absolute path in worktree
  projectPath: string; // relative path in project root
  deleted?: boolean;
}

export interface Worktree {
  path: string; // absolute path to worktree
  root: FileRef; // FileRef to worktree root
}

/**
 * Verify the project root is inside a git repository.
 */
export async function verifyGitRepo(projectRoot: FileRef): Promise<void> {
  try {
    await io.run("git rev-parse --git-dir", { cwd: projectRoot.path });
  } catch {
    throw new Error("Git repository required. Run \"git init\" first.");
  }
}

/**
 * Create a detached git worktree in a temp directory.
 * Returns the worktree path and a FileRef to it.
 */
export async function createWorktree(projectRoot: FileRef): Promise<Worktree> {
  const worktreePath = path.join(tmpdir(), `powerups-worktree-${randomBytes(6).toString("hex")}`);
  try {
    await io.run(`git worktree add "${worktreePath}" --detach`, {
      cwd: projectRoot.path,
    });
  } catch (e) {
    const message = typeof e === "string" ? e : String(e);
    throw new Error(`Failed to create git worktree: ${message}`, { cause: e });
  }
  return { path: worktreePath, root: fs.ref(worktreePath) };
}

/**
 * Remove a git worktree (force).
 */
export async function removeWorktree(
  projectRoot: FileRef,
  worktreePath: string,
): Promise<void> {
  try {
    await io.run(`git worktree remove --force "${worktreePath}"`, {
      cwd: projectRoot.path,
    });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Copy changed files from the worktree back to the project root.
 */
export async function copyChangedFiles(
  projectRoot: FileRef,
  changedFiles: ChangedFile[],
): Promise<void> {
  for (const { worktreePath, projectPath, deleted } of changedFiles) {
    const target = projectRoot.append(`/${projectPath}`);
    if (deleted) {
      await target.remove();
      continue;
    }
    await fs.create(target.directory);
    const content = await fs.ref(worktreePath).text();
    await target.write(content);
  }
}