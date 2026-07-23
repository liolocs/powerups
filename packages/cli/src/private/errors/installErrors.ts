import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, CLI_NAME, KEYWORD_PACKAGE, MAIN_FOLDER } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const install_errors = error.coded({
  missing_source: () => {
    const errorText =
      `Package source required.\n\nUsage: ${CLI_CMD} install <source>[#<powerups>] [flags]\n\n` +
      `Sources: npm:<package> | <git-url>`;
    return t`${errorBGText}${errorText}`;
  },

  fetch_failed: (source: string, message: string) => {
    const errorText = `Failed to fetch ${source}: ${message}`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: (source: string) => {
    const errorText =
      `${source} is not a valid powerups package.\n` +
      `Package must have the "${KEYWORD_PACKAGE}" keyword and a "powerups" property in its package.json.`;
    return t`${errorBGText}${errorText}`;
  },

  internal_not_installable: (name: string) => {
    const errorText =
      `"${name}" is an internal package name. Internal packages are created with "${CLI_CMD} pack", not installed.\n` +
      `Use npm:<name> or <git-url> to install from a remote source.`;
    return t`${errorBGText}${errorText}`;
  },

  global_not_initialized: () => {
    const errorText = `${CLI_NAME} is not initialized globally. Run "${CLI_CMD} init" first.`;
    return t`${errorBGText}${errorText}`;
  },

  local_not_initialized: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type InstallErrorCode = keyof typeof install_errors;
export const InstallErrorCode = Object.fromEntries(
  Object.keys(install_errors).map(k => [k, k]),
) as { [K in InstallErrorCode]: K };

export default install_errors;