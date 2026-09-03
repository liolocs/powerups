import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, PACKAGE_JSON_KEYWORD_PROPERTY } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const install_errors = error.coded({
  missing_source: () => {
    const errorText =
      `Package source required.\n\nUsage: ${CLI_CMD} install <source> [flags]\n\n` +
      `Sources: npm:<package> | git:<url> | <https-url>.git`;
    return t`${errorBGText}${errorText}`;
  },

  internal_not_installable: (name: string) => {
    const errorText =
      `"${name}" is an internal package name. Internal packages are created with "${CLI_CMD} create", not installed.\n` +
      `Use npm:<name> or git:<url> to install from a remote source.`;
    return t`${errorBGText}${errorText}`;
  },

  global_internal_not_installable: (name: string) => {
    const errorText =
      `"${name}" is already available as a global internal package.\n\n` +
      `Use it with: ${CLI_CMD} use ${name}\n\n`;
    return t`${errorBGText}${errorText}`;
  },

  fetch_failed: (source: string, message: string) => {
    const errorText = `Failed to fetch ${source}: ${message}`;
    return t`${errorBGText}${errorText}`;
  },

  stale_npm_package: ({ source, stalePackage }: { source: string; stalePackage: string }) => {
    const staleSource = `npm:${stalePackage}`;
    const errorText =
      `Failed to install ${source}.\n\n` +
      `Another package in the npm store could not be found on the registry, which prevents the install from completing:\n` +
      `  ${stalePackage}\n\n` +
      `This package may be left over from a previous failed install. ` +
      `If "${stalePackage}" is no longer in use, remove it with:\n` +
      `  ${CLI_CMD} uninstall ${staleSource}`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: (source: string, reason: string) => {
    const errorText =
      `${source} is not a valid powerups package.\n` +
      `${reason}`;
    return t`${errorBGText}${errorText}`;
  },

  already_installed: (name: string) => {
    const errorText =
      `A powerup named "${name}" is already installed.\n` +
      `Use "${CLI_CMD} use ${name}" to use it, or uninstall it first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type InstallErrorCode = keyof typeof install_errors;
export const InstallErrorCode = Object.fromEntries(
  Object.keys(install_errors).map(k => [k, k]),
) as { [K in InstallErrorCode]: K };

export default install_errors;