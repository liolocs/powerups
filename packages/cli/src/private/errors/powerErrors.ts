import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_NAME, CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const power_errors = error.coded({
  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} not found.`;
  },
  ambiguous: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} exists in both multi-use and single-use.\n` +
      `Specify --type=multi-use or --type=single-use to disambiguate.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_name: (command: string) => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} name required.\n\nUsage: ${CLI_CMD} ${command} <name>`;
    return t`${errorBGText}${errorText}`;
  },
  not_initialized: () => {
    const errorText = `${CLI_NAME} is not initialized — run "${CLI_CMD} init" first`;
    return t`${errorBGText}${errorText}`;
  },
});

export type PowerErrorCode = keyof typeof power_errors;

export const PowerErrorCode = Object.fromEntries(
  Object.keys(power_errors).map(k => [k, k]),
) as { [K in PowerErrorCode]: K };

export default power_errors;