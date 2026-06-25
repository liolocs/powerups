import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const command_errors = error.coded({
  missing_required_flags: (name: string) => t`
    ${cli.bg.red(cli.fg.white(" ERROR "))}
    Missing required arguments for the
    ${" " + cli.bg.yellow(" " + name + " ")} command.\n`,
  invalid_subcommand: (name: string, parent: string) => t`
    ${cli.bg.red(cli.fg.white(" ERROR "))}
    Invalid subcommand "${name}" for the
    ${" " + cli.bg.yellow(" " + parent + " ")} command.\n`,
  missing_required_subcommand: (name: string) => t`
    ${cli.bg.red(cli.fg.white(" ERROR "))}
    Missing required subcommand for the
    ${" " + cli.bg.yellow(" " + name + " ")} command.\n`,
});

export type CommandErrorCode = keyof typeof command_errors;

export const CommandErrorCode = Object.fromEntries(
  Object.keys(command_errors).map(k => [k, k]),
) as { [K in CommandErrorCode]: K };

export default command_errors;