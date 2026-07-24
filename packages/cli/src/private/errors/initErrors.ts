import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, CLI_CMD } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const printInit = CLI_CMD + " init";
const specifyHarness = `Harness options: \n\t${printInit} claude\n\t${printInit} opencode\n\t${printInit} pi\n\t${printInit} codex`;

const init_errors = error.coded({
  global_already_initialized: () => {
    return t`${errorLabel} ${CLI_NAME} is already initialized globally.`;
  },
  global_not_initialized: () => {
    const errorText =
      `${CLI_NAME} is not initialized. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
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