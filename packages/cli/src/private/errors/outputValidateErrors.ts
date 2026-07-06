import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const output_validate_errors = error.coded({
  no_outputs_found: () => {
    const errorText = "No outputs found to validate.";
    return t`${errorBGText}${errorText}`;
  },
  output_not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Output ${nameText} not found.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_output: (name: string, message: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Output ${nameText} is invalid: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
  validation_failed: (count: number) => {
    const countText = cli.bg.yellow(" " + String(count) + " ");
    const errorText = `Validation failed for ${countText} output(s).`;
    return t`${errorBGText}${errorText}`;
  },
});

export type OutputValidateErrorCode = keyof typeof output_validate_errors;

export const OutputValidateErrorCode = Object.fromEntries(
  Object.keys(output_validate_errors).map(k => [k, k]),
) as { [K in OutputValidateErrorCode]: K };

export default output_validate_errors;