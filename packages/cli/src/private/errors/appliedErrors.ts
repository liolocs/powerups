import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { APPLIED_FILE, CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const applied_errors = error.coded({
  corrupt_manifest: () => {
    const errorText =
      `${MAIN_FOLDER}/${APPLIED_FILE} is corrupt or not valid JSON. ` +
      `Re-run "${CLI_CMD} use" for the powerups you know were applied, or delete the file.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type AppliedErrorCode = keyof typeof applied_errors;

export const AppliedErrorCode = Object.fromEntries(
  Object.keys(applied_errors).map(k => [k, k]),
) as { [K in AppliedErrorCode]: K };

export default applied_errors;