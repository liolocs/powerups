import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const command_errors = error.coded({
  missing_required_flags: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `Missing required arguments for the ${nameText} command.\n`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_subcommand: (name: string, parent: string) => {
    const parentText = cli.bg.yellow(" " + parent + " ");
    const errorText =
      `Invalid subcommand ${cli.fg.red(name)} for the ${parentText} command.\n`;
    return t`${errorBGText}${errorText}`;
  },
  missing_required_subcommand: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `Missing required subcommand for the ${nameText} command.\n`;
    return t`${errorBGText}${errorText}`;
  },
});

export type CommandErrorCode = keyof typeof command_errors;

export const CommandErrorCode = Object.fromEntries(
  Object.keys(command_errors).map(k => [k, k]),
) as { [K in CommandErrorCode]: K };

export default command_errors;