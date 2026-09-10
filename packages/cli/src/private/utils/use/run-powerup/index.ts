import { type Instructions, type ManifestEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import runStep from "#utils/use/run-powerup/run-step";
import saveManifest from "#utils/use/run-powerup/save-manifest";
import is from "@rcompat/is";

export default async function runPowerup({
  destination,
  powerupDirectory,
  sourceBase,
  instructions,
  isDryRun,
  variables,
  powerupVersion,
  powerupLocation,
  saveManifest: shouldSaveManifest = true,
  overwriteExisting = false,
  skipInstallSteps = false,
  printFinalSummary = true,
}: {
  destination: FileRef;
  powerupDirectory: FileRef;
  sourceBase: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
  variables: ResolvedVariable;
  powerupVersion: string;
  powerupLocation: string;
  saveManifest?: boolean;
  overwriteExisting?: boolean;
  skipInstallSteps?: boolean;
  printFinalSummary?: boolean;
}): Promise<ManifestEntry[]> {
  const steps = instructions.steps;
  const collectedManifests: ManifestEntry[] = [];

  for (const step of steps) {
    const { manifest, variableUpdate } = await runStep({
      step,
      isDryRun,
      destination,
      powerupDirectory,
      sourceBase,
      variables,
      powerupName: instructions.name,
      powerupVersion,
      powerupLocation,
      powerupType: instructions.type,
      overwriteExisting,
      skipInstallSteps,
    });

    if (is.truthy(variableUpdate)) {
      variables[variableUpdate!.name] = variableUpdate!.value;
    }

    printStepSummary({ manifest });

    collectedManifests.push(manifest);

    if (!isDryRun && shouldSaveManifest && is.truthy(manifest)) {
      await saveManifest({ destination, manifest });
    }
  }

  if (!isDryRun && printFinalSummary) {
    const green = cli.fg.green;
    const blue = cli.fg.cyan;
    cli.print(`\n${green("✓")} Powerup ${instructions.name} was successfully used in ${blue(destination.path)}\n`);
  }

  return collectedManifests;
}

function printStepSummary({ manifest }: { manifest: ManifestEntry }): void {
  const { stepName, status, output } = manifest;
  const dim = cli.fg.dim;

  if (status === "skipped-warning") {
    cli.print(dim(`Skipped: ${stepName}\n`));
    return;
  }

  if (output.type === "create") {
    cli.print(dim(`Created: ${output.path}\n`));
    return;
  }

  if (output.type === "modify") {
    cli.print(dim(`Modified: ${output.path}\n`));
    return;
  }

  if (output.type === "read") {
    cli.print(dim(`Read: ${output.variable}\n`));
    return;
  }

  if (output.type === "delete") {
    cli.print(dim(`Deleted: ${output.path}\n`));
    return;
  }

  if (output.type === "install") {
    const allDeps: string[] = [];
    if (is.defined(output.dependencies) && output.dependencies.length > 0) {
      allDeps.push(...output.dependencies);
    }
    if (is.defined(output.devDependencies) && output.devDependencies.length > 0) {
      allDeps.push(...output.devDependencies);
    }
    if (is.defined(output.peerDependencies) && output.peerDependencies.length > 0) {
      allDeps.push(...output.peerDependencies);
    }

    cli.print(dim(`Installed dependencies: ${allDeps.join(", ")}\n`));
    return;
  }
}