import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const info_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} gain" first.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_name: () => {
    const errorText = `Power name required.\n\nUsage: ${CLI_CMD} info <name>`;
    return t`${errorBGText}${errorText}`;
  },
  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Power ${nameText} not found.`;
  },
});

export type InfoErrorCode = keyof typeof info_errors;

export const InfoErrorCode = Object.fromEntries(
  Object.keys(info_errors).map(k => [k, k]),
) as { [K in InfoErrorCode]: K };

export default info_errors;