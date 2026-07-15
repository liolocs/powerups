import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import init_errors from "#errors/initErrors";
import { scaffold, type RollbackInfo } from "#commands/init/scaffold/index";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

/**
 * Revert all filesystem changes recorded in `rollback`.
 *
 * - `rollback.remove`  – paths that were **newly created** by init: delete them.
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

const init = new Command({
  name: "init",

  description: `Initialize a ${CLI_NAME} project in the current directory`,

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
      throw init_errors.dry_folder_exists();
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

      const green = cli.fg.green;
      const dim = cli.fg.dim;

      cli.print(`${green("✓")} Initialized ${CLI_NAME} project\n`);
      cli.print(`  ${dim("harness:")} ${result.harness}\n`);

      for (const file of result.filesWritten) {
        cli.print(`  ${dim("wrote:")} ${file}\n`);
      }
    } catch (error) {
      // Revert any filesystem changes so re-running init works cleanly.
      await rollbackChanges({ root, rollback });
      throw error;
    }
  },
});

export default init;