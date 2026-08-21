import type { FileRef } from "@rcompat/fs";
import { addPackageToConfig, addPackageToGlobalConfig } from "#utils/config";

export default async function registerPowerup({
  name,
  isLocal,
  projectRoot,
}: {
  name: string;
  isLocal: boolean;
  projectRoot: FileRef;
}): Promise<void> {
  const entry = `internal:${name}`;

  if (isLocal) {
    await addPackageToConfig(projectRoot, entry);
  } else {
    await addPackageToGlobalConfig(entry);
  }
}