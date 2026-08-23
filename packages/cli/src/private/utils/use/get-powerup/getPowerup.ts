import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import getPowerupInstallFromConfig from "#utils/use/get-powerup/getPowerupInstallFromConfig";
import is from "@rcompat/is";
import use_errors from "#errors/useErrors";

export default async function getPowerup({
  cwd,
  globalPowerupsDir,
  name: powerupName,
}: {
    cwd: FileRef;
    globalPowerupsDir: FileRef;
  name: string;
  }): Promise<{ instructions: Instructions, location: FileRef, version: string }> {
  const localConfigRef = cwd.append(`/${CLI_FOLDER_NAME}/config.json`);
  const globalConfigRef = globalPowerupsDir.append("/config.json");

  let localConfig: Awaited<ReturnType<typeof getPowerupInstallFromConfig>>;
  let globalConfig: Awaited<ReturnType<typeof getPowerupInstallFromConfig>>;;

  try {
    localConfig = await getPowerupInstallFromConfig({ configRef: localConfigRef, powerupName });
  } catch {
    // it is fine if the local config.json is not found or invalid
  }

  try {
    globalConfig = await getPowerupInstallFromConfig({ configRef: globalConfigRef, powerupName });
  } catch {
    // it is fine if the global config.json is not found or invalid
  }

  // @ts-expect-error it is fine to use before its defined in this case
  if (is.defined(localConfig)) {
    const powerupDir = cwd.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER[localConfig.where]}/${powerupName}`);

    return fetchPowerup({ powerupDir, powerupName });
    // @ts-expect-error it is fine to use before its defined in this case
  } else if (is.defined(globalConfig)) {
    const powerupDir = globalPowerupsDir.append(`/${INSTALLED_FOLDER[globalConfig.where]}/${powerupName}`);

    return fetchPowerup({ powerupDir, powerupName });
  } else {
    throw use_errors.not_installed(powerupName);
  }
}

async function fetchPowerup({
  powerupName,
  powerupDir,
}: {
    powerupName: string;
    powerupDir: FileRef;
  }) {
  if (await powerupDir.exists() === false) {
    throw use_errors.powerup_missing(powerupName);
  }

  let instructionsJSON: Instructions;
  try {
    instructionsJSON = await powerupDir.append("/dist/instructions.json").json();
  } catch {
    throw use_errors.instructions_not_built(powerupName);
  }

  let version: string;
  try {
    const pkgJson = await powerupDir.append("/package.json").json() as Record<string, unknown>;

    if (is.falsy(pkgJson.version)) {
      throw new Error("version not found");
    }

    version = pkgJson.version as unknown as string;
  } catch {
    throw use_errors.package_json_error(powerupName);
  }

  return {
    instructions: instructionsJSON,
    location: powerupDir,
    version: version,
  };
}