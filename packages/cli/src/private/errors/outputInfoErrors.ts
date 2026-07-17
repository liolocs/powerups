import error from "@rcompat/error";
import cli from "@rcompat/cli";
import string from "@rcompat/string";
import { CLI_NAME, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputInfoErrors(domain: string) {
  return error.coded({
    dry_folder_not_found: () => {
      const errorText = `.${MAIN_FOLDER} folder not found. Run "${CLI_NAME} init" first.`;
      return t`${errorBGText}${errorText}`;
    },
    missing_name: () => {
      const errorText =
        `${string.upperfirst(domain)} name required.\n\nUsage: ${CLI_NAME} ${domain} info <name>`;
      return t`${errorBGText}${errorText}`;
    },
    not_found: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${string.upperfirst(domain)} ${nameText} not found.`;
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_info_errors = createOutputInfoErrors("template");
const output_feature_info_errors = createOutputInfoErrors("feature");

export type OutputTemplateInfoErrorCode =
  keyof typeof output_template_info_errors;

export type OutputFeatureInfoErrorCode =
  keyof typeof output_feature_info_errors;

export const OutputTemplateInfoErrorCode = Object.fromEntries(
  Object.keys(output_template_info_errors).map(k => [k, k]),
) as { [K in OutputTemplateInfoErrorCode]: K };

export const OutputFeatureInfoErrorCode = Object.fromEntries(
  Object.keys(output_feature_info_errors).map(k => [k, k]),
) as { [K in OutputFeatureInfoErrorCode]: K };

const errors = {
  template: output_template_info_errors,
  feature: output_feature_info_errors,
};

export default errors;