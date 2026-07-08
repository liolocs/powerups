import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME, capitalize } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

export default function createOutputCreateErrors(domain: string) {
  return error.coded({
    dry_folder_not_found: () => {
      const errorText =
        `Dry folder not found. Run "${CLI_NAME} init" first.`;
      return t`${errorBGText}${errorText}`;
    },
    already_exists: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText =
        `${capitalize(domain)} ${nameText} already exists.`;
      return t`${errorBGText}${errorText}`;
    },
    invalid_output_json: () => {
      const errorText =
        "Invalid JSON for --output flag.";
      return t`${errorBGText}${errorText}`;
    },
  });
}

export type OutputCreateErrorCode = "dry_folder_not_found" | "already_exists" | "invalid_output_json";

export const OutputCreateErrorCode = {
  dry_folder_not_found: "dry_folder_not_found",
  already_exists: "already_exists",
  invalid_output_json: "invalid_output_json",
} as const;