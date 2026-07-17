import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const create_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText = `Dry folder not found. Run "${CLI_CMD} gain" first.`;
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
    const errorText = `Power ${nameText} already exists.`;
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
});

export type CreateErrorCode = keyof typeof create_errors;

export const CreateErrorCode = Object.fromEntries(
  Object.keys(create_errors).map(k => [k, k]),
) as { [K in CreateErrorCode]: K };

export default create_errors;