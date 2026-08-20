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

  return config.packages.some(p => {
    // entries are stored as prefixed source strings (e.g. "internal:test-powerup")
    // or as objects with a `.package` field; match the name either bare or
    // after the source prefix, consistent with getPowerupInstallFromConfig.
    const source = typeof p === "string" ? p : p.package;
    return source === powerupName || source?.split(":")[1] === powerupName;
  });
}