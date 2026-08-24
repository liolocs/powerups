import install_errors from "#errors/installErrors";
import is from "@rcompat/is";

export default function checkSourceWasPassed(source?: string): void {
  if (is.undefined(source) || source === "") {
    throw install_errors.missing_source();
  }
}