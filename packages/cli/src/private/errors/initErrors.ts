import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const printInit = CLI_CMD + " project init";
const specifyHarness = `Harness options: \n\t${printInit} --harness claude\n\t${printInit} --harness opencode\n\t${printInit} --harness pi\n\t${printInit} --harness codex`;

const init_errors = error.coded({
  no_harness_detected: () => {
    return t`${errorLabel} No AI coding harness detected.\n\n  ${specifyHarness}`;
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