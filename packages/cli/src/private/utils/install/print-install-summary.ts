import cli from "@rcompat/cli";

export default function printInstallSummary({
  source,
  isLocal,
  storeType,
  isDryRun,
}: {
  source: string;
  isLocal: boolean;
  storeType: "npm" | "git" | "internal";
  isDryRun: boolean;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;
  const location = isLocal ? "local" : "global";

  if (isDryRun) {
    cli.print(`${green("✓")} (dry-run) Would install ${source}\n`);
  } else {
    cli.print(`${green("✓")} Installed ${source}\n`);
  }

  cli.print(`  ${dim("location:")} ${location}\n`);
  cli.print(`  ${dim("store:")} ${storeType}\n`);
}