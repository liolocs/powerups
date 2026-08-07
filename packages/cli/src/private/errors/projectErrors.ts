import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, CLI_CMD, CLI_FOLDER_NAME } from "#constants";

const t = error.template;

const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const project_errors = error.coded({
  project_already_initialized: () => {
    return t`${errorLabel} ${CLI_NAME} is already initialized for this project.`;
  },
  project_not_initialized: () => {
    const errorText = `${CLI_FOLDER_NAME} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type ProjectErrorCode = keyof typeof project_errors;

export const ProjectErrorCode = Object.fromEntries(
  Object.keys(project_errors).map(k => [k, k]),
) as { [K in ProjectErrorCode]: K };

export default project_errors;