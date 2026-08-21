import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

export default function checkNameWasPassed(powerupName?: string): void {
  if (is.undefined(powerupName) || is.falsy(powerupName)) {
    throw create_errors.missing_name();
  }
}