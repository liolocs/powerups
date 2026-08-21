import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_CMD, CLI_FOLDER_NAME, SINGULAR_NAME_FOR_CLI } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const create_errors = error.coded({
  main_folder_not_found: () => {
    const errorText = `${CLI_FOLDER_NAME} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_capture: (value: string) => {
    const errorText =
      `Invalid --capture value "${value}". Must be "all" or "workingDir".\n\n` +
      `Usage: ${CLI_CMD} create <name> --capture=<all|workingDir>`;
    return t`${errorBGText}${errorText}`;
  },
  already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} already exists.`;
    return t`${errorBGText}${errorText}`;
  },
  missing_name: () => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} name is required.\n\n` +
      `Usage: ${CLI_CMD} create <name> [options]`;
    return t`${errorBGText}${errorText}`;
  },
  missing_description: () => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} description is required.\n\n` +
      `Usage: ${CLI_CMD} create <name> --description="..."`;
    return t`${errorBGText}${errorText}`;
  },
  global_root_not_found: () => {
    const errorText =
      `Global ${CLI_FOLDER_NAME} folder not found. Run "${CLI_CMD} project init" first, or use --local to create locally.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type CreateErrorCode = keyof typeof create_errors;

export const CreateErrorCode = Object.fromEntries(
  Object.keys(create_errors).map(k => [k, k]),
) as { [K in CreateErrorCode]: K };

export default create_errors;