import { type Instructions } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import runStep from "#utils/use/run-powerup/run-step";
import saveManifest from "#utils/use/run-powerup/save-manifest";

export default async function runPowerup({
  destination,
  powerupDirectory,
  instructions,
  isDryRun,
  variables,
}: {
  destination: FileRef;
  powerupDirectory: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
  variables: ResolvedVariable;
}): Promise<void> {
  const steps = instructions.steps;

  for (const step of steps) {
    const manifest = await runStep({ step, isDryRun, destination, powerupDirectory, variables });

    if (!isDryRun && manifest) {
      await saveManifest({ destination: powerupDirectory, manifest });
    }
  }
}