import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
import matchesPowerupName from "#utils/shared/matches-powerup-name";

export default async function findPowerupInConfig({
  configRef,
  powerupName,
}: {
  configRef: FileRef;
  powerupName: string;
}): Promise<PackageEntry | null> {
  let config;

  try {
    config = await getConfig(configRef);
  } catch {
    return null;
  }

  return config.packages.find(pkg => matchesPowerupName(pkg, powerupName)) ?? null;
}