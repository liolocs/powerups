import use_errors from "#errors/useErrors";
import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/getPowerup/getConfig";
import is from "@rcompat/is";

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

  const found = config.packages.find(p => p.includes(powerupName));

  if (is.falsy(found)) {
    throw use_errors.not_in_config(powerupName);
  }

  return {
    where: determineInstallationType(found!),
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