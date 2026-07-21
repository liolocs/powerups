import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@powers/program";
import gain_errors from "#errors/gainErrors";
import { scaffold, type RollbackInfo } from "#scaffold/index";
import { writeConfig } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

/**
 * Revert all filesystem changes recorded in `rollback`.
 *
 * - `rollback.remove`  – paths that were **newly created** by gain: delete them.
 * - `rollback.restore` – files that **already existed** but were modified:
 *                        overwrite them with the backed-up original content.
 *
 * Best-effort: individual cleanup failures are swallowed so that the
 * *original* error is always the one the user sees.
 */
async function rollbackChanges({
  root,
  rollback,
}: {
  root: FileRef;
  rollback: RollbackInfo;
}): Promise<void> {
  for (const relativePath of rollback.remove) {
    try {
      const ref = root.append(`/${relativePath}`);
      if (await fs.exists(ref)) {
        await ref.remove();
      }
    } catch {
      // best-effort cleanup — never mask the original error
    }
  }

  for (const { path, content } of rollback.restore) {
    try {
      await root.append(`/${path}`).write(content);
    } catch {
      // best-effort restore — never mask the original error
    }
  }
}

const gain = new Command({
  name: "gain",

  description: `Gain ${CLI_NAME} for the current project`,

  flags: [
    {
      name: "harness",
      long: "harness",
      short: "H",
      description:
        "Override harness detection ( claude | opencode | pi | codex )",
    },
  ],

  subcommands: [],

  action: async ({ context, flags }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    if (await fs.exists(mainFolder)) {
      throw gain_errors.dry_folder_exists();
    }

    const rollback: RollbackInfo = { remove: [], restore: [] };

    try {
      await fs.create(mainFolder);
      rollback.remove.push(MAIN_FOLDER);

      // Run scaffold with optional --harness override
      const harnessFlag = flags.harness as string | undefined;
      const result = await scaffold(root, harnessFlag, {
        skipGlobal: context?.skipGlobal,
        rollback,
      });

      // Persist the resolved harness so `powers update` can reuse it
      await writeConfig(root, { harness: result.harness, packages: [] });

      const green = cli.fg.green;
      const dim = cli.fg.dim;

      cli.print(`${green("✓")} Gained ${CLI_NAME} for project\n`);
      cli.print(`  ${dim("harness:")} ${result.harness}\n`);

      for (const file of result.filesWritten) {
        cli.print(`  ${dim("wrote:")} ${file}\n`);
      }
    } catch (error) {
      // Revert any filesystem changes so re-running gain works cleanly.
      await rollbackChanges({ root, rollback });
      throw error;
    }
  },
});

export default gain;