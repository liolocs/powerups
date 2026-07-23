import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_CMD, MAIN_FOLDER } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const create_errors = error.coded({
  main_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_type: () => {
    const errorText =
      `--type flag is required (multi-use or single-use).\n\n` +
      `Usage: ${CLI_CMD} create --type=<multi-use|single-use> -n=<name> ...`;
    return t`${errorBGText}${errorText}`;
  },
  already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} already exists.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_output_json: () => {
    const errorText = "Invalid JSON for --output flag.";
    return t`${errorBGText}${errorText}`;
  },
  invalid_package_deps_json: () => {
    const errorText = "Invalid JSON for --package-deps flag.";
    return t`${errorBGText}${errorText}`;
  },
  missing_pack: () => {
    const errorText =
      `--pack flag is required.\n\n` +
      `Usage: ${CLI_CMD} create --pack=<package-name> --type=<multi-use|single-use> -n=<name> ...`;
    return t`${errorBGText}${errorText}`;
  },
  pack_not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Package ${nameText} not found. Run "${CLI_CMD} pack create ${name}" first.`;
  },
});

export type CreateErrorCode = keyof typeof create_errors;

export const CreateErrorCode = Object.fromEntries(
  Object.keys(create_errors).map(k => [k, k]),
) as { [K in CreateErrorCode]: K };

export default create_errors;