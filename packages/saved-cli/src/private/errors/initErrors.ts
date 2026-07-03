import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const init_errors = error.coded({
  dry_folder_exists: () => {
    const errorText = "Dry folder already exists.";
    return t`${errorBGText}${errorText}`;
  },
  no_harness_detected: () => {
    const errorText =
      `No AI coding harness detected.\n` +
      `Specify one with --harness=<claude|opencode|pi|codex>.\n` +
      `Example: savedai init --harness=claude`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_harness: (value: string) => {
    const valueText = cli.bg.yellow(" " + value + " ");
    const errorText =
      `Invalid harness ${valueText}.\n` +
      `Valid values: claude, opencode, pi, codex.`;
    return t`${errorBGText}${errorText}`;
  },
  claude_md_exists_not_symlink: () => {
    const errorText =
      `CLAUDE.md exists and is not a symlink.\n` +
      `Remove it or replace it with a symlink to AGENTS.md, then re-run init.`;
    return t`${errorBGText}${errorText}`;
  },
  agents_section_render_failed: (detail: string) => {
    const errorText =
      `Failed to render AGENTS.md section: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type InitErrorCode = keyof typeof init_errors;

export const InitErrorCode = Object.fromEntries(
  Object.keys(init_errors).map(k => [k, k]),
) as { [K in InitErrorCode]: K };

export default init_errors;