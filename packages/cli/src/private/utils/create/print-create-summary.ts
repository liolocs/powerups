import cli from "@rcompat/cli";
import type { CaptureResult } from "#utils/create/capture-files/index";
import is from "@rcompat/is";

export default function printCreateSummary({
  name,
  outputPath,
  isDryRun,
  captureResult,
}: {
  name: string;
    outputPath: string;
  isDryRun: boolean;
  captureResult?: CaptureResult;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const powerupHighlight = (text: string) => cli.bg.yellow(cli.fg.white(" " + text + " "));
  const colorForPath = cli.fg.blue;

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would create powerup: ${name} at ${outputPath}\n`);
  } else {
    cli.print(`${green("✓")} ${"Created powerup"}: ${powerupHighlight(name)} at ${colorForPath(outputPath)}\n`);
  }

  if (is.truthy(captureResult)) {
    if (captureResult!.steps.length > 0) {
      cli.print(`  ${dim("captured:")} ${captureResult!.fileCount} files, ${captureResult!.steps.length} steps\n`);
    }
    if (captureResult!.warnings.length > 0) {
      cli.print(`  ${dim("warnings:")}\n`);
      for (const warning of captureResult!.warnings) {
        cli.print(`    - ${warning}\n`);
      }
    }
  }
}