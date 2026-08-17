import { type PowerupConfig } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import getIsPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/getIsPowerupInConfig";
import use_errors from "#errors/useErrors";
import { CLI_FOLDER_NAME } from "#constants";

export default async function checkForPowerupInConfig({
  cwd, powerupName,
}: {
  cwd: FileRef; powerupName?: string;
}): Promise<void> {
  const configRef = cwd.append(`/${CLI_FOLDER_NAME}/config.json`);

  if (await configRef.exists() === false) {
    throw use_errors.config_not_found();
  }

  const config: PowerupConfig =
    await configRef.json();

  const isPowerupInConfig = getIsPowerupInConfig({ config, powerupName });

  if (!isPowerupInConfig) {
    throw use_errors.not_in_config();
  }
}