import cli from "@rcompat/cli";

export default function printUninstallSummary({
  powerupName,
  source,
  isLocal,
  storeType,
  isDryRun,
  removedPath,
}: {
  powerupName: string;
  source: string;
  isLocal: boolean;
  storeType: "npm" | "git" | "internal";
  isDryRun: boolean;
  removedPath: string;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const location = isLocal ? "local" : "global";

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would uninstall ${powerupName}\n`);
  } else {
    cli.print(`${green("✓")} Uninstalled ${powerupName}\n`);
  }

  cli.print(`  ${dim("source:")} ${source}\n`);
  cli.print(`  ${dim("location:")} ${location}\n`);
  cli.print(`  ${dim("store:")} ${storeType}\n`);

  if (!isDryRun) {
    cli.print(`  ${dim("path:")} ${removedPath}\n`);
  }
}