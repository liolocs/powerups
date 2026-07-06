import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const generate_output_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText =
      `Dry folder not found. Run "${CLI_NAME} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
  output_already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText =
      `Output ${nameText} already exists.`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_output_json: () => {
    const errorText =
      "Invalid JSON for --output flag.";
    return t`${errorBGText}${errorText}`;
  },
});

export type GenerateOutputErrorCode = keyof typeof generate_output_errors;

export const GenerateOutputErrorCode = Object.fromEntries(
  Object.keys(generate_output_errors).map(k => [k, k]),
) as { [K in GenerateOutputErrorCode]: K };

export default generate_output_errors;
