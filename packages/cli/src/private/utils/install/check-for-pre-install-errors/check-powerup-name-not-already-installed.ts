import type { FileRef } from "@rcompat/fs";
import { readConfig, readGlobalConfig } from "#utils/config";
import matchesPowerupName from "#utils/shared/matches-powerup-name";
import install_errors from "#errors/installErrors";

export default async function checkPowerupNameNotAlreadyInstalled({
  powerupName,
  isLocal,
  projectRoot,
  homeDir,
}: {
  powerupName: string;
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<void> {
  const config = isLocal
    ? await readConfig(projectRoot)
    : await readGlobalConfig(homeDir);

  if (config === null) return;

  const alreadyInstalled = config.packages.some(entry =>
    matchesPowerupName(entry, powerupName),
  );

  if (alreadyInstalled) {
    throw install_errors.already_installed(powerupName);
  }
}