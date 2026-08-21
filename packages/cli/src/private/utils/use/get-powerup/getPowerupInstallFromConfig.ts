import use_errors from "#errors/useErrors";
import { type PackageEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
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
  }): Promise<{
    where: "internal" | "npm" | "git";
  }> {
  const config = await getConfig(configRef);

  const found = config.packages.find(
    pkg => getPackageSource(pkg).split(":")[1] === powerupName,
  );

  if (is.falsy(found)) {
    throw use_errors.not_in_config(powerupName);
  }

  return {
    where: determineInstallationType(getPackageSource(found!)),
  };
}

function determineInstallationType(name: string): "internal" | "npm" | "git" {
  if (name.startsWith("internal:")) {
    return "internal";
  }
  if (name.startsWith("npm:")) {
    return "npm";
  }
  if (name.startsWith("git:")) {
    return "git";
  }

  throw use_errors.unsupported_package_type(name);
}