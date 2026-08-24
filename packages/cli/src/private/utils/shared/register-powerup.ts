import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

export default async function registerPowerup({
  configEntry,
  powerupName,
  isLocal,
  projectRoot,
  homeDir,
}: {
  configEntry: string;
  powerupName?: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  const entry = powerupName !== undefined
    ? { package: configEntry, name: powerupName }
    : configEntry;

  if (isLocal) {
    await addPackageToConfig(projectRoot, entry);
  } else {
    await addPackageToGlobalConfig(entry, homeDir);
  }
}