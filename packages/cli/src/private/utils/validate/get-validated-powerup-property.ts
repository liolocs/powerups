import { powerupPropertySchema, type PowerupProperty } from "@liolocs/powerups-sdk";
import { SINGULAR_NAME_FOR_CLI } from "#constants";
import shared_errors from "#errors/sharedErrors";

export default function getValidatedPowerupProperty(
  pkgJson: Record<string, unknown>,
): PowerupProperty {
  const result = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME_FOR_CLI]);

  if (!result.success) {
    const detail = result.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw shared_errors.invalid_powerup_property(detail);
  }

  return result.data;
}