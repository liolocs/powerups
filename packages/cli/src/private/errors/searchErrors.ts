import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const search_errors = error.coded({
  no_matching: () => {
    const errorText = "No matching powers found.";
    return t`${errorBGText}${errorText}`;
  },
  no_query: () => {
    const errorText =
      `No search query provided. Example: ${CLI_CMD} search -q="<query>"`;
    return t`${errorBGText}${errorText}`;
  },
});

export type SearchErrorCode = keyof typeof search_errors;

export const SearchErrorCode = Object.fromEntries(
  Object.keys(search_errors).map(k => [k, k]),
) as { [K in SearchErrorCode]: K };

export default search_errors;