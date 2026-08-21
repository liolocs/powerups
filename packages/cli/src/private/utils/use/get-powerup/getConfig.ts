import use_errors from "#errors/useErrors";
import { powerupConfigSchema, type PowerupConfig } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";

export async function getConfig(
  configRef: FileRef,
): Promise<PowerupConfig> {
  if (await configRef.exists() === false) {
    throw use_errors.config_not_found();
  }

  try {
    return powerupConfigSchema.parse(await configRef.json());
  } catch {
    throw use_errors.config_invalid_file();
  }
}