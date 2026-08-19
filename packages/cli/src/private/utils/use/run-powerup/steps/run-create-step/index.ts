import { type CreateManifestEntry, type CreateStep } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { type BaseManifestProperties } from "#utils/use/run-powerup/run-step";
export default async function runCreateStep({
  step,
  isDryRun,
  destination,
  powerupDir,
}: {
  step: CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDir: FileRef;
}): Promise<Omit<CreateManifestEntry, BaseManifestProperties>> {
}