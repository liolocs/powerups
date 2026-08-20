import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import getPowerupInstallFromConfig from "#utils/use/get-powerup/getPowerupInstallFromConfig";
import is from "@rcompat/is";
import use_errors from "#errors/useErrors";

export default async function getPowerup({
  root,
  globalRoot,
  name: powerupName,
}: {
  root: FileRef;
  globalRoot: FileRef;
  name: string;
  }): Promise<{ instructions: Instructions, location: FileRef, version: string }> {
  const localConfigRef = root.append(`/${CLI_FOLDER_NAME}/config.json`);
  const globalConfigRef = globalRoot.append("/config.json");

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
    // get it from the local config
    return fetchPowerup({ root, installationType: localConfig.where, powerupName });
    // @ts-expect-error it is fine to use before its defined in this case
  } else if (is.defined(globalConfig)) {
    // get it from the global config
    return fetchPowerup({ root: globalRoot, installationType: globalConfig.where, powerupName });
  } else {
    throw use_errors.not_installed(powerupName);
  }
}

async function fetchPowerup({
  root,
  installationType,
  powerupName,
}: {
  root: FileRef;
  installationType: "internal" | "npm" | "git";
  powerupName: string;
}) {
  const powerupDir = root.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER[installationType]}/${powerupName}`);

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

    console.log(JSON.stringify(pkgJson));

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