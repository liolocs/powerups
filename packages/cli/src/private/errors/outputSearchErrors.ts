import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputSearchErrors(domain: string) {
  return error.coded({
    no_matching: () => {
      const errorText = `No matching ${domain}s found.`;
      return t`${errorBGText}${errorText}`;
    },
    no_query: () => {
      const errorText =
        `No search query provided. Example: ${CLI_NAME} ${domain} search -q "<query>"`;
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_search_errors = createOutputSearchErrors("template");
const output_feature_search_errors = createOutputSearchErrors("feature");

export type OutputTemplateSearchErrorCode =
  keyof typeof output_template_search_errors;

export type OutputFeatureSearchErrorCode =
  keyof typeof output_feature_search_errors;

export const OutputTemplateSearchErrorCode = Object.fromEntries(
  Object.keys(output_template_search_errors).map(k => [k, k]),
) as { [K in OutputTemplateSearchErrorCode]: K };

export const OutputFeatureSearchErrorCode = Object.fromEntries(
  Object.keys(output_feature_search_errors).map(k => [k, k]),
) as { [K in OutputFeatureSearchErrorCode]: K };

const errors = {
  template: output_template_search_errors,
  feature: output_feature_search_errors,
};

export default errors;