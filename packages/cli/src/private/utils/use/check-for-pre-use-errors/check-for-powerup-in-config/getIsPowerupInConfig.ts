import { type PowerupConfig } from "@liolocs/powerups-sdk";
import is from "@rcompat/is";
import matchesPowerupName from "#utils/shared/matches-powerup-name";

export default function getIsPowerupInConfig({
  config, powerupName,
}: {
  config: PowerupConfig; powerupName?: string;
}): boolean {
  if (is.falsy(powerupName)) {
    return false;
  }

  return config.packages.some(p => matchesPowerupName(p, powerupName!));
}