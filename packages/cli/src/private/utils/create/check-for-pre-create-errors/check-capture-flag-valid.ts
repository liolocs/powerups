import create_errors from "#errors/createErrors";
import is from "@rcompat/is";

const VALID_CAPTURE_VALUES = ["all", "workingDir"];

export default function checkCaptureFlagValid(captureValue?: string): void {
  if (is.defined(captureValue) && !VALID_CAPTURE_VALUES.includes(captureValue)) {
    throw create_errors.invalid_capture(captureValue);
  }
}