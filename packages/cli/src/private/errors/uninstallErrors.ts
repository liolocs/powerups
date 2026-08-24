import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const uninstall_errors = error.coded({
  missing_name: () => {
    const errorText =
      `Powerup name required.\n\nUsage: ${CLI_CMD} uninstall <name> [flags]`;
    return t`${errorBGText}${errorText}`;
  },

  not_installed: (name: string) => {
    const errorText =
      `"${name}" is not installed.\n` +
      `Use "${CLI_CMD} install" to install it first.`;
    return t`${errorBGText}${errorText}`;
  },

  internal_not_uninstallable: (name: string) => {
    const errorText =
      `"${name}" is an internal powerup. Internal powerups are created with "${CLI_CMD} create", not installed, so they cannot be uninstalled.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type UninstallErrorCode = keyof typeof uninstall_errors;

export const UninstallErrorCode = Object.fromEntries(
  Object.keys(uninstall_errors).map(k => [k, k]),
) as { [K in UninstallErrorCode]: K };

export default uninstall_errors;