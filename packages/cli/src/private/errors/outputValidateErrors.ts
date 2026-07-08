import error from "@rcompat/error";
import cli from "@rcompat/cli";
import string from "@rcompat/string";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputValidateErrors(domain: string) {
  return error.coded({
    no_outputs_found: () => {
      const errorText = `No ${domain}s found to validate.`;
      return t`${errorBGText}${errorText}`;
    },
    not_found: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${string.upperfirst(domain)} ${nameText} not found.`;
      return t`${errorBGText}${errorText}`;
    },
    invalid: (name: string, message: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${string.upperfirst(domain)} ${nameText} is invalid: ${message}`;
      return t`${errorBGText}${errorText}`;
    },
    validation_failed: (count: number) => {
      const countText = cli.bg.yellow(" " + String(count) + " ");
      const errorText = `Validation failed for ${countText} ${domain}(s).`;
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_validate_errors = createOutputValidateErrors("template");
const output_feature_validate_errors = createOutputValidateErrors("feature");

export type OutputTemplateValidateErrorCode =
  keyof typeof output_template_validate_errors;

export type OutputFeatureValidateErrorCode =
  keyof typeof output_feature_validate_errors;

export const OutputTemplateValidateErrorCode = Object.fromEntries(
  Object.keys(output_template_validate_errors).map(k => [k, k]),
) as { [K in OutputTemplateValidateErrorCode]: K };

export const OutputFeatureValidateErrorCode = Object.fromEntries(
  Object.keys(output_feature_validate_errors).map(k => [k, k]),
) as { [K in OutputFeatureValidateErrorCode]: K };

const errors = {
  template: output_template_validate_errors,
  feature: output_feature_validate_errors,
};

export default errors;