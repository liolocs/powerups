import { ManifestEntry, type Step } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";

export default async function runInstallStep({
  step,
  isDryRun,
  destination,
}: {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  }): Promise<ManifestEntry> {
}