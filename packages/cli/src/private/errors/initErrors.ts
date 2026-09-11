import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const init_errors = error.coded({
  missing_harness: () => {
    return t`${errorLabel} Missing harness argument.\n\n  Usage: ${CLI_CMD} harness <init|update|remove> <harness>\n  Valid values: claude, opencode, pi, codex`;
  },
  invalid_harness: (value: string) => {
    return t`${errorLabel} Invalid harness: ${cli.fg.yellow(value)}\n\n  Valid values: claude, opencode, pi, codex`;
  },
});

export type InitErrorCode = keyof typeof init_errors;

export const InitErrorCode = Object.fromEntries(
  Object.keys(init_errors).map(k => [k, k]),
) as { [K in InitErrorCode]: K };

export default init_errors;