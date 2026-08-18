import { CLI_FOLDER_NAME, GLOBAL_ROOT } from "#constants";
import type { Instructions, PowerupConfig } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import getPowerupInstallFromConfig from "#utils/use/getPowerup/getPowerupInstallFromConfig";

export default async function getPowerup({
  root,
  globalRoot,
  name: powerupName,
}: {
  root: FileRef;
  globalRoot: FileRef;
  name: string;
}): Promise<{ instructions: Instructions }> {
  /**
   * should should for the powerup:
   * 1. locally: .powerups/installed/_internal, .powerups/installed/.npm, .powerups/installed/.git folders
   * 2. globally: ~/.powerups/installed/_internal, ~/.powerups/installed/.npm, ~/.powerups/installed/.git folders
   */

  const localConfigRef = root.append(`/${CLI_FOLDER_NAME}/config.json`);
  const globalConfigRef = globalRoot.append("/config.json");

  let localConfig: PowerupConfig;

  try {
    localConfig = await getPowerupInstallFromConfig({ configRef: localConfigRef, powerupName });
  } catch {
    // it is fine if the local config.json is not found or invalid
  }

  const globalConfig = await getPowerupInstallFromConfig({ configRef: globalConfigRef, powerupName });

  const searchLocations = [
    root, GLOBAL_ROOT,
  ];

  for (const searchLocation of searchLocations) {
    const powerupDir = searchLocation.append(`/${powerupName}`);

    if (await powerupDir.exists()) {
      return { instructions: powerupDir };
    }
  }
}