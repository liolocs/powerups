import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const validate_errors = error.coded({
  missing_name: () => {
    const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} name required.\n\nUsage: ${CLI_CMD} validate <name>`;
    return t`${errorBGText}${errorText}`;
  },
  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} not found.`;
  },
  invalid: (name: string, message: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} is invalid: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type ValidateErrorCode = keyof typeof validate_errors;

export const ValidateErrorCode = Object.fromEntries(
  Object.keys(validate_errors).map(k => [k, k]),
) as { [K in ValidateErrorCode]: K };

export default validate_errors;