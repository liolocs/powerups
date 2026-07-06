import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const pattern_validate_errors = error.coded({
  no_patterns_found: () => {
    const errorText = "No patterns found to validate.";
    return t`${errorBGText}${errorText}`;
  },
  pattern_not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Pattern ${nameText} not found.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_pattern: (name: string, message: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Pattern ${nameText} is invalid: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
  validation_failed: (count: number) => {
    const countText = cli.bg.yellow(" " + String(count) + " ");
    const errorText = `Validation failed for ${countText} pattern(s).`;
    return t`${errorBGText}${errorText}`;
  },
});

export type PatternValidateErrorCode = keyof typeof pattern_validate_errors;

export const PatternValidateErrorCode = Object.fromEntries(
  Object.keys(pattern_validate_errors).map(k => [k, k]),
) as { [K in PatternValidateErrorCode]: K };

export default pattern_validate_errors;