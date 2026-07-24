import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const update_errors = error.coded({
  no_mode: () => {
    const errorText =
      `Specify what to update:\n\n` +
      `\t${CLI_CMD} update --all         # ai harnesses + all packages\n` +
      `\t${CLI_CMD} update --harness     # ai harnesses only\n` +
      `\t${CLI_CMD} update --packages    # packages only\n` +
      `\t${CLI_CMD} update <source>      # one package`;
    return t`${errorLabel}${errorText}`;
  },

  conflicting_flags: (flags: string) => {
    return t`${errorLabel}Cannot combine ${flags}. See "${CLI_CMD} update --help".`;
  },

  package_not_found: (source: string) => {
    return t`${errorLabel}Package "${source}" is not installed (not found in local or global stores).`;
  },
});

export type UpdateErrorCode = keyof typeof update_errors;

export const UpdateErrorCode = Object.fromEntries(
  Object.keys(update_errors).map((k) => [k, k]),
) as { [K in UpdateErrorCode]: K };

export default update_errors;