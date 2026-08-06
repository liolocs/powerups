import fs, { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import cli from "@rcompat/cli";
import type { ManifestEntry } from "#utils/manifest";

/**
 * Targeted revert of a failed run's file changes against a clean-tree git repo.
 * - created files → delete
 * - modified/deleted files → git checkout -- <path> (restores HEAD)
 * node_modules changes from install steps cannot be reverted; print a notice.
 */
export async function revertChanges(
  root: FileRef,
  files: ManifestEntry["files"],
): Promise<void> {
  let touchedNodeModules = false;

  for (const file of files) {
    if (file.path.includes("node_modules")) {
      touchedNodeModules = true;
      continue;
    }
    try {
      if (file.action === "create") {
        const ref = root.append(`/${file.path}`);
        if (await fs.exists(ref)) {
          await ref.remove();
        }
      } else {
        // modify or delete — restore from HEAD
        await io.run(`git checkout -- "${file.path}"`, { cwd: root.path });
      }
    } catch (e) {
      cli.print(`Warning: could not revert ${file.path}: ${String(e)}\n`);
    }
  }

  if (touchedNodeModules) {
    cli.print(
      "Notice: node_modules changes from an install step could not be reverted. " +
      "Re-run your package manager's install command if the tree looks wrong.\n",
    );
  }
}