import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { homedir } from "node:os";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import project_errors from "#errors/projectErrors";
import { scaffold, type RollbackInfo } from "#scaffold/index";
import { writeConfig, ensureGlobalInit } from "#utils/config";
import { MAIN_FOLDER, CLI_NAME } from "#constants";

const projectInit = new Command({
  name: "init",

  description: `Initialize ${CLI_NAME} for the current project`,

  flags: [
    {
      name: "harness",
      long: "harness",
      short: "H",
      description:
        "Harness(es) to scaffold, comma-separated (claude,opencode,pi,codex). Omit to auto-detect from the project root.",
    },
  ],

  subcommands: [],

  action: async ({ context, flags }: any) => {
    const homeDirStr = context?.homeDir ?? homedir();
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const harnessFlag: string | undefined = flags?.harness ?? undefined;

    if (await fs.exists(mainFolder)) {
      throw project_errors.project_already_initialized();
    }

    const green = cli.fg.green;
    const dim = cli.fg.dim;

    // 1. Ensure the shared global store exists (bootstrap once, skip if present).
    //    The global store is intentionally NOT rolled back if a later step fails —
    //    it is shared and may already hold packages.
    const bootstrapped = await ensureGlobalInit(homeDirStr);
    if (bootstrapped) {
      cli.print(`${green("✓")} Bootstrapped ${CLI_NAME} globally\n`);
    }

    // 2. Project config.
    await fs.create(mainFolder);
    await writeConfig(root, { packages: [] });

    // 3. Harness scaffold into the project root.
    const rollback: RollbackInfo = { remove: [MAIN_FOLDER], restore: [] };

    try {
      const result = await scaffold(root, harnessFlag, { rollback });

      cli.print(`${green("✓")} Initialized ${CLI_NAME} for project\n`);
      cli.print(`  ${dim("harnesses:")} ${result.harnesses.join(", ")}\n`);

      for (const file of result.filesWritten) {
        cli.print(`  ${dim("wrote:")} ${file}\n`);
      }
    } catch (error) {
      await rollbackChanges({ root, rollback });
      throw error;
    }
  },
});

export default projectInit;

/**
 * Revert project-level filesystem changes recorded in `rollback`.
 *
 * - `rollback.remove`  – paths newly created by init: delete them (includes
 *   the `.powerups` folder itself, seeded before scaffold).
 * - `rollback.restore` – files that already existed but were modified:
 *   overwrite with the backed-up original content.
 *
 * Best-effort: individual cleanup failures are swallowed so the *original*
 * error is always the one the user sees.
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