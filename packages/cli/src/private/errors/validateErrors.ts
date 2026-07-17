import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const validate_errors = error.coded({
  missing_name: () => {
    const errorText = "Power name required.\n\nUsage: pwrs validate <name>";
    return t`${errorBGText}${errorText}`;
  },
  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Power ${nameText} not found.`;
  },
  invalid: (name: string, message: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Power ${nameText} is invalid: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type ValidateErrorCode = keyof typeof validate_errors;

export const ValidateErrorCode = Object.fromEntries(
  Object.keys(validate_errors).map(k => [k, k]),
) as { [K in ValidateErrorCode]: K };

export default validate_errors;