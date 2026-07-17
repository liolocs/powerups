import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const doctor_errors = error.coded({
  not_initialized: () => {
    const errorText = `${MAIN_FOLDER}} folder not found. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  validation_failed: (count: number) => {
    const countText = cli.bg.yellow(" " + String(count) + " ");
    const errorText = `Doctor found ${countText} error(s). See output above.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type DoctorErrorCode = keyof typeof doctor_errors;

export const DoctorErrorCode = Object.fromEntries(
  Object.keys(doctor_errors).map(k => [k, k]),
) as { [K in DoctorErrorCode]: K };

export default doctor_errors;