import fs from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";

export default async function runCaptureWithRollback<T>({
  capture,
  newPowerupDirectory,
  isDryRun,
}: {
  capture: () => Promise<T>;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<T> {
  try {
    return await capture();
  } catch (error) {
    if (!isDryRun && (await newPowerupDirectory.exists())) {
      await newPowerupDirectory.remove({ recursive: true });
      const dim = cli.fg.dim;
      cli.print(`${dim(`Removed partially created powerup at ${newPowerupDirectory.path}`)}\n`);
    }

    throw error;
  }
}