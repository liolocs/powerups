import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const printGain = CLI_CMD + " gain";
const specifyHarness = `Harness options: \n\t${printGain} --harness=claude\n\t${printGain} --harness=opencode\n\t${printGain} --harness=pi\n\t${printGain} --harness=codex`;

const gain_errors = error.coded({
  main_folder_not_found: () => {
    const errorText =
      `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} gain" first.`;
    return t`${errorBGText}${errorText}`;
  },
  dry_folder_exists: () => {
    return t`${errorLabel} ${CLI_NAME} project already initialized.`;
  },
  no_harness_detected: () => {
    return t`${errorLabel} No AI coding harness detected.\n\n  ${specifyHarness}`;
  },
  invalid_harness: (value: string) => {
    return t`${errorLabel} Invalid harness: ${cli.fg.yellow(value)}\n\n  Valid values: claude, opencode, pi, codex`;
  },
  multiple_harnesses_detected: (harnesses: string[]) => {
    return t`${errorLabel} Multiple harnesses detected: ${cli.fg.yellow(harnesses.join(", "))}\n\n  ${specifyHarness}`;
  },
  agents_section_render_failed: (detail: string) => {
    return t`${errorLabel} Failed to render instruction section: ${detail}`;
  },
});

export type GainErrorCode = keyof typeof gain_errors;

export const GainErrorCode = Object.fromEntries(
  Object.keys(gain_errors).map(k => [k, k]),
) as { [K in GainErrorCode]: K };

export default gain_errors;