import error from "@rcompat/error";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const runner_errors = error.coded({
  unsupported_template_type: (ext: string, templatePath: FileRef) => {
    const errorText =
      `Unsupported template type: ${ext}\n` +
      `Only .ts and .njk templates are supported.\n` +
      `Template: ${templatePath.name}`;
    return t`${errorBGText}${errorText}`;
  },
  template_not_found: (template: string) => {
    const errorText = `Template file not found: ${template}`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_ts_template: (templatePath: FileRef) => {
    const errorText =
      `Invalid .ts template: ${templatePath.name}\n` +
      `Must export a default function that returns a string.`;
    return t`${errorBGText}${errorText}`;
  },
  unsupported_runtime: (name: string) => {
    const errorText =
      `Unsupported runtime: ${name}\n` +
      `.ts templates require bun, deno, or node with --experimental-strip-types.`;
    return t`${errorBGText}${errorText}`;
  },
  template_execution_error: (template: string, message: string) => {
    const errorText = `Error executing template ${template}: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type RunnerErrorCode = keyof typeof runner_errors;

export const RunnerErrorCode = Object.fromEntries(
  Object.keys(runner_errors).map(k => [k, k]),
) as { [K in RunnerErrorCode]: K };

export default runner_errors;