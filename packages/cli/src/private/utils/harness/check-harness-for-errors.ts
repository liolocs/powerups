import init_errors from "#errors/initErrors";
import { VALID_HARNESSES, type Harness } from "#constants";

export default function checkHarnessForErrors(harness?:string): void {
  if (harness === undefined) {
    throw init_errors.missing_harness();
  }

  if (!VALID_HARNESSES.includes(harness as Harness)) {
    throw init_errors.invalid_harness(harness);
  }
}