import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { homedir } from "node:os";
import { Command } from "@powerups/program";
import init_errors from "#errors/initErrors";
import { scaffold, type RollbackInfo } from "#scaffold/index";
import { writeGlobalConfig } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const init = new Command({
  name: "init",

  description: `Initialize ${CLI_NAME} globally`,

  flags: [],

  subcommands: [],

  action: async ({ context, subcommands }: any) => {
    const homeDirStr = context?.homeDir ?? homedir();
    const homeDir = fs.ref(homeDirStr);
    const globalRoot = homeDir.append(`/${MAIN_FOLDER}`);

    if (await fs.exists(globalRoot)) {
      throw init_errors.global_already_initialized();
    }

    const rollback: RollbackInfo = { remove: [], restore: [] };

    try {
      await fs.create(globalRoot);

      rollback.remove.push(MAIN_FOLDER);

      // Scaffold to home directory with all detected harnesses
      const harnessArg = subcommands?.[0] as string | undefined;
      const result = await scaffold(homeDir, harnessArg, { rollback });

      // Write global config (no harness field)
      await writeGlobalConfig({ packages: [] }, homeDirStr);

      const green = cli.fg.green;
      const dim = cli.fg.dim;

      cli.print(`${green("✓")} Initialized ${CLI_NAME} globally\n`);
      cli.print(`  ${dim("harnesses:")} ${result.harnesses.join(", ")}\n`);

      for (const file of result.filesWritten) {
        cli.print(`  ${dim("wrote:")} ${file}\n`);
      }
    } catch (error) {
      // Revert any filesystem changes so re-running init works cleanly.
      await rollbackChanges({ root: homeDir, rollback });
      throw error;
    }
  },
});

export default init;

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
