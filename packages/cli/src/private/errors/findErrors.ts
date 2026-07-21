import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const find_errors = error.coded({
  no_matching: () => {
    const errorText = "No matching powers found.";
    return t`${errorBGText}${errorText}`;
  },
  no_query: () => {
    const errorText =
      `No search query provided. Example: ${CLI_CMD} find -q="<query>"`;
    return t`${errorBGText}${errorText}`;
  },
});

export type FindErrorCode = keyof typeof find_errors;

export const FindErrorCode = Object.fromEntries(
  Object.keys(find_errors).map(k => [k, k]),
) as { [K in FindErrorCode]: K };

export default find_errors;