import { type PowerupConfig } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import getIsPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig";
import use_errors from "#errors/useErrors";
import { CLI_FOLDER_NAME, GLOBAL_ROOT } from "#constants";
import { homedir } from "node:os";
import path from "node:path";
import fs from "@rcompat/fs";

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

  if (await globalConfigRef.exists() === false) {
    throw use_errors.global_config_not_found();
  }

  const globalConfig: PowerupConfig =
    await globalConfigRef.json();
  const localConfig: PowerupConfig =
    await localConfigRef.json();

  const isPowerupInLocalConfig = getIsPowerupInConfig({ config: localConfig, powerupName });
  const isPowerupInGlobalConfig = getIsPowerupInConfig({ config: globalConfig, powerupName });

  if (!isPowerupInGlobalConfig && !isPowerupInLocalConfig) {
    throw use_errors.not_installed(powerupName!);
  }
}