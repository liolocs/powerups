import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { SINGULAR_NAME_FOR_CLI } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const shared_errors = error.coded({
  invalid_powerup_property: (detail: string) => {
    const errorText =
      `Invalid ${SINGULAR_NAME_FOR_CLI} property in package.json.\n` +
      `Expected an object with an "instructions" string field.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type SharedErrorCode = keyof typeof shared_errors;
export const SharedErrorCode = Object.fromEntries(
  Object.keys(shared_errors).map(k => [k, k]),
) as { [K in SharedErrorCode]: K };

export default shared_errors;