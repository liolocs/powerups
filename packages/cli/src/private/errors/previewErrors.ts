import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { SINGULAR_NAME_FOR_CLI } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const preview_errors = error.coded({
  instructions_not_found: (root: string, entryFile: string) => {
    const errorText =
      `No ${entryFile} found at ${root}.\n\n` +
      `"pup author preview" and "pup author template" must run inside a powerup package.\n` +
      `Check the "${SINGULAR_NAME_FOR_CLI}.instructions" entry in package.json.`;
    return t`${errorBGText}${errorText}`;
  },
  preview_json_invalid: (detail: string) => {
    const errorText =
      `preview.json is not valid JSON.\n\n${detail}`;
    return t`${errorBGText}${errorText}`;
  },
  missing_variables: (missing: string[], required: string[]) => {
    const missingText = missing.join(", ");
    const requiredText = required.join(", ");
    const errorText =
      `Missing required variables: ${missingText}\n\n` +
      `Required: ${requiredText}\n` +
      `Provide them in preview.json ("variables") or as flags: --<name>=<value>`;
    return t`${errorBGText}${errorText}`;
  },
});

export type PreviewErrorCode = keyof typeof preview_errors;

export const PreviewErrorCode = Object.fromEntries(
  Object.keys(preview_errors).map(k => [k, k]),
) as { [K in PreviewErrorCode]: K };

export default preview_errors;
