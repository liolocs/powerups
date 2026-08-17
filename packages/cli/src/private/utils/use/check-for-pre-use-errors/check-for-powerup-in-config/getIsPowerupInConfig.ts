import { type PowerupConfig } from "@liolocs/powerups-sdk";
import is from "@rcompat/is";

export default function getIsPowerupInConfig({
  config, powerupName,
}: {
  config: PowerupConfig; powerupName?: string;
}): boolean {
  if (is.falsy(powerupName)) {
    return false;
  }

  return config.packages.includes(powerupName!);
}