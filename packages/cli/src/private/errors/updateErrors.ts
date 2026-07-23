import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

// no_harness_config removed — update no longer reads harness from config.
// detectHarnesses throws init_errors.no_harness_detected when nothing is found.

const update_errors = error.coded({});

export type UpdateErrorCode = keyof typeof update_errors;

export const UpdateErrorCode = Object.fromEntries(
  Object.keys(update_errors).map((k) => [k, k]),
) as { [K in UpdateErrorCode]: K };

export default update_errors;