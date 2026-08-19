import { type Instructions } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import runStep from "#utils/use/run-powerup/run-step";
import saveManifest from "#utils/use/run-powerup/save-manifest";

export default async function runPowerup({
  destination,
  powerupDir,
  instructions,
  isDryRun,
}: {
  destination: FileRef;
  powerupDir: FileRef;
  instructions: Instructions;
  isDryRun: boolean;
}): Promise<void> {
  const steps = instructions.steps;

  for (const step of steps) {
    const manifest = await runStep({ step, isDryRun, destination, powerupDir });

    if (!isDryRun && manifest) {
      await saveManifest({ destination: powerupDir, manifest });
    }
  }
}