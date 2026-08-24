import uninstall_errors from "#errors/uninstallErrors";
import is from "@rcompat/is";

export default function checkNameWasPassed(name?: string): void {
  if (is.undefined(name) || name === "") {
    throw uninstall_errors.missing_name();
  }
}