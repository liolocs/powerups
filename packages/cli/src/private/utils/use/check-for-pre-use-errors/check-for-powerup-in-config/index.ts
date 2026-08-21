import { type FileRef } from "@rcompat/fs";
import { getConfig } from "#utils/use/get-powerup/getConfig";
import getIsPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig";
import use_errors from "#errors/useErrors";
import { CLI_FOLDER_NAME } from "#constants";

export default async function checkForPowerupInConfig({
  cwd,
  powerupName,
  globalRoot,
}: {
    cwd: FileRef;
    powerupName?: string;
    globalRoot: FileRef;
}): Promise<void> {
  const globalConfigRef = globalRoot.append("/config.json");
  const localConfigRef = cwd.append(`/${CLI_FOLDER_NAME}/config.json`);

  const globalConfigExists = await globalConfigRef.exists();
  const localConfigExists = await localConfigRef.exists();

  // if (await globalConfigRef.exists() === false) {
  //   throw use_errors.global_config_not_found();
  // }

  const hasNoConfigAnywhere = localConfigExists === false && globalConfigExists === false;
  if (hasNoConfigAnywhere) {
    throw use_errors.not_installed(powerupName!);
  }

  if (localConfigExists && !globalConfigExists) {
    const localConfig = await getConfig(localConfigRef);
    const isPowerupInLocalConfig = getIsPowerupInConfig({ config: localConfig, powerupName });

    if (!isPowerupInLocalConfig) {
      throw use_errors.not_installed(powerupName!);
    }
  } else if (!localConfigExists && globalConfigExists) {
    const globalConfig = await getConfig(globalConfigRef);
    const isPowerupInGlobalConfig = getIsPowerupInConfig({ config: globalConfig, powerupName });

    if (!isPowerupInGlobalConfig) {
      throw use_errors.not_installed(powerupName!);
    }
  } else {
    const localConfig = await getConfig(localConfigRef);
    const globalConfig = await getConfig(globalConfigRef);

    const isPowerupInLocalConfig = getIsPowerupInConfig({ config: localConfig, powerupName });
    const isPowerupInGlobalConfig = getIsPowerupInConfig({ config: globalConfig, powerupName });

    if (!isPowerupInLocalConfig && !isPowerupInGlobalConfig) {
      throw use_errors.not_installed(powerupName!);
    }
  }
}