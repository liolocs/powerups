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
  old_format_instructions: () => {
    const errorText =
      `This powerup uses the pre-0.3 template-wrapped step format (create/modify steps with "template" fields), which is no longer supported.\n\n` +
      `Re-capture it with "pup create <name> --capture=all", or convert steps by hand:\n` +
      `  - create steps with variables  \u2192 { type: "dynamic-create", template: "src/dynamic-create/<file>.ts", ... }\n` +
      `  - create steps without variables \u2192 { type: "create", file: "src/create/<file>", ... }\n` +
      `  - modify steps with variables  \u2192 { type: "dynamic-modify", template: "src/dynamic-modify/<file>.ts", ... }\n` +
      `  - modify steps without variables \u2192 { type: "modify", file: "src/modify/<file>.json", ... }`;
    return t`${errorBGText}${errorText}`;
  },
});

export type SharedErrorCode = keyof typeof shared_errors;
export const SharedErrorCode = Object.fromEntries(
  Object.keys(shared_errors).map(k => [k, k]),
) as { [K in SharedErrorCode]: K };

export default shared_errors;