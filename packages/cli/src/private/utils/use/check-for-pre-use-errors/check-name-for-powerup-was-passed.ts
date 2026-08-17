import use_errors from "#errors/useErrors";
import is from "@rcompat/is";

export default function checkNameForPowerupWasPassed(
  powerupName?: string,
) {
  if (is.undefined(powerupName) || is.falsy(powerupName)) {
    throw use_errors.missing_name();
  }
}