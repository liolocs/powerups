import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const update_errors = error.coded({
  no_harness_config: () => {
    const errorText =
      `No harness configuration found.\n\n  Run "${CLI_NAME} init" first, or specify a harness:\n\n\t${CLI_NAME} update --harness=claude\n\t${CLI_NAME} update --harness=opencode\n\t${CLI_NAME} update --harness=pi\n\t${CLI_NAME} update --harness=codex`;
    return t`${errorLabel}${errorText}`;
  },
});

export type UpdateErrorCode = keyof typeof update_errors;

export const UpdateErrorCode = Object.fromEntries(
  Object.keys(update_errors).map((k) => [k, k]),
) as { [K in UpdateErrorCode]: K };

export default update_errors;