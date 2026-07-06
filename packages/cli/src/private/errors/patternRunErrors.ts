import error from "@rcompat/error";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const pattern_run_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText = `Dry folder not found. Run "${CLI_NAME} init" first.`;
    return t`${errorBGText}${errorText}`;
  },

  missing_pattern_name: () => {
    const errorText =
      `Pattern name required.\nUsage: ${CLI_NAME} pattern run <pattern-name> [variables]`;
    return t`${errorBGText}${errorText}`;
  },

  pattern_not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    const errorText = `Pattern ${nameText} not found.`;
    return t`${errorBGText}${errorText}`;
  },

  missing_variable: (variable: string, flagName: string) => {
    const errorText =
      `Missing required variable: ${variable}\n` +
      `Provide it with --${flagName}=<value>`;
    return t`${errorBGText}${errorText}`;
  },

  template_not_found: (template: string) => {
    const errorText = `Template file not found: ${template}`;
    return t`${errorBGText}${errorText}`;
  },

  unsupported_template_type: (ext: string, templatePath: FileRef) => {
    const errorText =
      `Unsupported template type: ${ext}\n` +
      `Only .ts and .njk templates are supported.\n` +
      `Template: ${templatePath.name}`;
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

  invalid_composition: (issues: string[]) => {
    const issueList = issues.map(i => `  - ${i}`).join("\n");
    const errorText =
      `Pattern composition is invalid:\n${issueList}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type PatternRunErrorCode = keyof typeof pattern_run_errors;

export const PatternRunErrorCode = Object.fromEntries(
  Object.keys(pattern_run_errors).map(k => [k, k]),
) as { [K in PatternRunErrorCode]: K };

export default pattern_run_errors;