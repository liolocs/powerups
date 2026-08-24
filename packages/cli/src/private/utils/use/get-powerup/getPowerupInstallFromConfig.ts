import use_errors from "#errors/useErrors";
import { type FileRef } from "@rcompat/fs";
import { getPackageSource } from "#utils/config";
import findPowerupInConfig from "#utils/shared/find-powerup-in-config";

export default async function getPowerupInstallFromConfig({
  powerupName,
  configRef,
}: {
  powerupName: string;
  configRef: FileRef;
}): Promise<{ source: string }> {
  const entry = await findPowerupInConfig({ configRef, powerupName });

  if (entry === null) {
    throw use_errors.not_in_config(powerupName);
  }

  return { source: getPackageSource(entry) };
}