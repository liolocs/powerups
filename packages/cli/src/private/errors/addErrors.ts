import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const add_errors = error.coded({
  missing_source: () => {
    const errorText =
      `Package source required.\n\nUsage: ${CLI_CMD} add <source>[#<powerups>] [flags]`;
    return t`${errorBGText}${errorText}`;
  },

  package_not_installed: (source: string) => {
    const errorText =
      `Package ${source} is not installed.\n` +
      `Run "${CLI_CMD} install ${source}" first.`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: (source: string) => {
    const errorText =
      `${source} is not a valid powerups package.\n` +
      `Package must have a "powerups" property in its package.json.`;
    return t`${errorBGText}${errorText}`;
  },

  project_not_initialized: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type AddErrorCode = keyof typeof add_errors;
export const AddErrorCode = Object.fromEntries(
  Object.keys(add_errors).map(k => [k, k]),
) as { [K in AddErrorCode]: K };

export default add_errors;