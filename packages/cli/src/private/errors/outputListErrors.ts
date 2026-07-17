import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputListErrors(domain: string) {
  return error.coded({
    dry_folder_not_found: () => {
      const errorText = `.${MAIN_FOLDER} folder not found. Run "${CLI_NAME} init" first.`;
      return t`${errorBGText}${errorText}`;
    },
    no_matching: () => {
      const errorText = `No ${domain}s found.`;
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_list_errors = createOutputListErrors("template");
const output_feature_list_errors = createOutputListErrors("feature");

export type OutputTemplateListErrorCode =
  keyof typeof output_template_list_errors;

export type OutputFeatureListErrorCode =
  keyof typeof output_feature_list_errors;

export const OutputTemplateListErrorCode = Object.fromEntries(
  Object.keys(output_template_list_errors).map(k => [k, k]),
) as { [K in OutputTemplateListErrorCode]: K };

export const OutputFeatureListErrorCode = Object.fromEntries(
  Object.keys(output_feature_list_errors).map(k => [k, k]),
) as { [K in OutputFeatureListErrorCode]: K };

const errors = {
  template: output_template_list_errors,
  feature: output_feature_list_errors,
};

export default errors;