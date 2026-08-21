import cli from "@rcompat/cli";
import type { CaptureResult } from "#utils/create/capture-files/index";

export default function printCreateSummary({
  name,
  isDryRun,
  captureResult,
}: {
  name: string;
  isDryRun: boolean;
  captureResult?: CaptureResult;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would create powerup: ${name}\n`);
  } else {
    cli.print(`${green("✓")} Created powerup: ${name}\n`);
  }

  if (captureResult) {
    if (captureResult.steps.length > 0) {
      cli.print(`  ${dim("captured:")} ${captureResult.fileCount} files, ${captureResult.steps.length} steps\n`);
    }
    if (captureResult.warnings.length > 0) {
      cli.print(`  ${dim("warnings:")}\n`);
      for (const warning of captureResult.warnings) {
        cli.print(`    - ${warning}\n`);
      }
    }
  }
}