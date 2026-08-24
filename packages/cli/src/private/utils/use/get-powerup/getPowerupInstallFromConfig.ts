import use_errors from "#errors/useErrors";
import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
import matchesPowerupName from "#utils/shared/matches-powerup-name";
import is from "@rcompat/is";

function getPackageSource(entry: PackageEntry): string {
  return typeof entry === "string" ? entry : entry.package;
}

export default async function getPowerupInstallFromConfig({
  powerupName,
  configRef,
}: {
  powerupName: string;
  configRef: FileRef;
}): Promise<{ source: string }> {
  const config = await getConfig(configRef);

  const found = config.packages.find(pkg =>
    matchesPowerupName(pkg, powerupName),
  );

  if (is.falsy(found)) {
    throw use_errors.not_in_config(powerupName);
  }

  return { source: getPackageSource(found!) };
}