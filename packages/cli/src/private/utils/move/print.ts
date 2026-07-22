import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";
import { CLI_NAME } from "#constants";
import type { CollectedSubPowerUp } from "#utils/move/collect";

type PrintMoveResultParams = {
  packageName: string;
  globalPackageDir: FileRef;
  collected: Map<string, CollectedSubPowerUp>;
  shouldDelete: boolean;
};

/**
 * Print the result of a successful `pack move` operation.
 */
export function printMoveResult({
  packageName,
  globalPackageDir,
  collected,
  shouldDelete,
}: PrintMoveResultParams): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Moved package: ${packageName} → global\n`);
  cli.print(`  ${dim("global location:")} ${globalPackageDir.path}\n`);

  if (collected.size > 0) {
    cli.print(`  ${dim(`sub-${CLI_NAME} pulled in:`)} ${collected.size}\n`);
    for (const [subName, info] of collected) {
      cli.print(`    ${dim("-")} ${subName} (from ${info.parent})\n`);
    }
  }

  cli.print(`  ${dim("removed local package from project")}\n`);

  if (shouldDelete) {
    cli.print(`  ${dim("removed from project config")}\n`);
  } else {
    cli.print(`  ${dim("kept in project config (resolves from global)")}\n`);
  }
}