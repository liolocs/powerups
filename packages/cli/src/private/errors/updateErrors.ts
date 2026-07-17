import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const update_errors = error.coded({
  no_harness_config: () => {
    const errorText =
      `No harness configuration found.\n\n  Run "${CLI_CMD} init" first, or specify a harness:\n\n\t${CLI_CMD} update --harness=claude\n\t${CLI_CMD} update --harness=opencode\n\t${CLI_CMD} update --harness=pi\n\t${CLI_CMD} update --harness=codex`;
    return t`${errorLabel}${errorText}`;
  },
});

export type UpdateErrorCode = keyof typeof update_errors;

export const UpdateErrorCode = Object.fromEntries(
  Object.keys(update_errors).map((k) => [k, k]),
) as { [K in UpdateErrorCode]: K };

export default update_errors;