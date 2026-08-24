import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

export default async function registerPowerup({
  configEntry,
  isLocal,
  projectRoot,
  homeDir,
}: {
  configEntry: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  if (isLocal) {
    await addPackageToConfig(projectRoot, configEntry);
  } else {
    await addPackageToGlobalConfig(configEntry, homeDir);
  }
}