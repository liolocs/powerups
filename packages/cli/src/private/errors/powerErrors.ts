import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const power_errors = error.coded({
  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Power ${nameText} not found.`;
  },
  ambiguous: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `Power ${nameText} exists in both multi-use and single-use.\n` +
      `Specify --type=multi-use or --type=single-use to disambiguate.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_name: (command: string) => {
    const errorText =
      `Power name required.\n\nUsage: ${CLI_CMD} ${command} <name>`;
    return t`${errorBGText}${errorText}`;
  },
});

export type PowerErrorCode = keyof typeof power_errors;

export const PowerErrorCode = Object.fromEntries(
  Object.keys(power_errors).map(k => [k, k]),
) as { [K in PowerErrorCode]: K };

export default power_errors;