import { type Instructions, type ManifestEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import type { ResolvedVariable } from "#utils/variables";
import runStep from "#utils/use/run-powerup/run-step";
import type { BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import saveManifest from "#utils/use/run-powerup/save-manifest";
import is from "@rcompat/is";

export default async function runPowerup({
  destination,
  powerupDirectory,
  instructions,
  isDryRun,
  variables,
  powerupVersion,
  powerupLocation,
}: {
  destination: FileRef;
  powerupDirectory: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
  variables: ResolvedVariable;
    powerupVersion: string;
    powerupLocation: string;
}): Promise<void> {
  const steps = instructions.steps;

  for (const step of steps) {
    const { manifest, variableUpdate } = await runStep({ step, isDryRun, destination, powerupDirectory, variables });

    if (is.truthy(variableUpdate)) {
      variables[variableUpdate!.name] = variableUpdate!.value;
    }

    const fullManifest: ManifestEntry = {
      ...manifest,
      powerupName: instructions.name,
      version: powerupVersion,
      location: powerupLocation,
      type: instructions.type,
    };

    printStepSummary({ manifest: fullManifest });

    if (!isDryRun && is.truthy(manifest)) {
      await saveManifest({
        destination,
        manifest: fullManifest,
      });
    }
  }
}

function printStepSummary({
  manifest,
}: {
    manifest: ManifestEntry;
}): void {
  const { stepName, status, output } = manifest;

  if (status === "skipped-warning") {
    cli.print(`Skipped: ${stepName}\n`);
    return;
  }

  if (output.type === "create") {
    cli.print(`Created: ${output.path}\n`);
    return;
  }

  if (output.type === "modify") {
    cli.print(`Modified: ${output.path}\n`);
    return;
  }

  if (output.type === "read") {
    cli.print(`Read: ${output.variable}\n`);
    return;
  }

  if (output.type === "delete") {
    cli.print(`Deleted: ${output.path}\n`);
    return;
  }

  if (output.type === "install") {
    cli.print(`Installed dependencies\n`);
    return;
  }
}