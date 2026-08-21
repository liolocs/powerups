import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

export default function checkDescriptionWasPassed(description?: string): void {
  if (is.undefined(description) || is.falsy(description)) {
    throw create_errors.missing_description();
  }
}