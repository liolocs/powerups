import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const output_search_errors = error.coded({
  no_matching_outputs: () => {
    const errorText =
      "No matching outputs found.";
    return t`${errorBGText}${errorText}`;
  },
});

export type OutputSearchErrorCode = keyof typeof output_search_errors;

export const OutputSearchErrorCode = Object.fromEntries(
  Object.keys(output_search_errors).map(k => [k, k]),
) as { [K in OutputSearchErrorCode]: K };

export default output_search_errors;
