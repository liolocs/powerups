import { InstallManifestEntry, InstallStep } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";

export default async function runInstallStep({
  step,
  isDryRun,
  destination,
}: {
    step: InstallStep;
    isDryRun: boolean;
    destination: FileRef;
  }): Promise<InstallManifestEntry> {
}