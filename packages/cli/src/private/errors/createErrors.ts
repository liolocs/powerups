import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_CMD, MAIN_FOLDER, SINGULAR_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const create_errors = error.coded({
  main_folder_not_found: () => {
    const errorText = `${MAIN_FOLDER} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_type: () => {
    const errorText =
      `Invalid --type value. Must be "multi-use" or "single-use".\n\n` +
      `Usage: ${CLI_CMD} create <name> --type=<multi-use|single-use> ...`;
    return t`${errorBGText}${errorText}`;
  },
  already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} already exists.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_package_deps_json: () => {
    const errorText = "Invalid JSON for --package-deps flag.";
    return t`${errorBGText}${errorText}`;
  },
  not_a_git_repo: () => {
    const errorText = `Working directory is not a git repository. Run "${CLI_CMD} create <name>" without --working-dir to create a blank ${SINGULAR_NAME}.`;
    return t`${errorBGText}${errorText}`;
  },
  package_not_initialized: () => {
    const errorText = `Could not determine package name from package.json. Pass --pack=<name> explicitly.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_name: () => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} name is required.\n\n` +
      `Usage: ${CLI_CMD} create <name> [options]`;
    return t`${errorBGText}${errorText}`;
  },
});

export type CreateErrorCode = keyof typeof create_errors;

export const CreateErrorCode = Object.fromEntries(
  Object.keys(create_errors).map(k => [k, k]),
) as { [K in CreateErrorCode]: K };

export default create_errors;