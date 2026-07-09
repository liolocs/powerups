import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";
import string from "@rcompat/string";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputCreateErrors(domain: string) {
  return error.coded({
    dry_folder_not_found: () => {
      const errorText =
        `Dry folder not found. Run "${CLI_NAME} init" first.`;
      return t`${errorBGText}${errorText}`;
    },
    already_exists: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText =
        `${string.upperfirst(domain)} ${nameText} already exists.`;
      return t`${errorBGText}${errorText}`;
    },
    invalid_output_json: () => {
      const errorText =
        "Invalid JSON for --output flag.";
      return t`${errorBGText}${errorText}`;
    },
    invalid_package_deps_json: () => {
      const errorText =
        "Invalid JSON for --package-deps flag.";
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_create_errors = createOutputCreateErrors("template");
const output_feature_create_errors = createOutputCreateErrors("feature");

export type OutputTemplateCreateErrorCode =
  keyof typeof output_template_create_errors;

export type OutputFeatureCreateErrorCode =
  keyof typeof output_feature_create_errors;

export const OutputTemplateCreateErrorCode = Object.fromEntries(
  Object.keys(output_template_create_errors).map(k => [k, k]),
) as { [K in OutputTemplateCreateErrorCode]: K };

export const OutputFeatureCreateErrorCode = Object.fromEntries(
  Object.keys(output_feature_create_errors).map(k => [k, k]),
) as { [K in OutputFeatureCreateErrorCode]: K };

const errors = {
  template: output_template_create_errors,
  feature: output_feature_create_errors,
};

export default errors;