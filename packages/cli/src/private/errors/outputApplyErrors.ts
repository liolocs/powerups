import error from "@rcompat/error";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";
import { CLI_NAME } from "#constants";
import string from "@rcompat/string";
import { toKebabCase } from "#utils/variables";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

function createOutputApplyErrors(domain: string) {
  return error.coded({
    dry_folder_not_found: () => {
      const errorText = `Dry folder not found. Run "${CLI_NAME} init" first.`;
      return t`${errorBGText}${errorText}`;
    },

    missing_name: () => {
      const errorText =
        `${string.upperfirst(domain)} name required.\nUsage: ${CLI_NAME} ${domain} apply <name> [variables]`;
      return t`${errorBGText}${errorText}`;
    },

    not_found: (name: string) => {
      const nameText = cli.bg.yellow(" " + name + " ");
      const errorText = `${string.upperfirst(domain)} ${nameText} not found.`;
      return t`${errorBGText}${errorText}`;
    },

    missing_variables: (
      missing: string[],
      required: string[],
      domain: string,
      name: string,
    ) => {
      const missingList = missing.join(", ");
      const requiredList = required
        .map(v => `  --${toKebabCase(v)}=<value>`)
        .join("\n");
      const example = `${CLI_NAME} ${domain} apply ${name} ${
        required.map(v => `--${toKebabCase(v)}=<value>`).join(" ")
      }`;
      const errorText =
        `Missing required variables: ${missingList}\n` +
        `\nAll required variables:\n${requiredList}\n` +
        `\nExample:\n  ${example}`;
      return t`${errorBGText}${errorText}`;
    },

    template_not_found: (template: string) => {
      const errorText = `Template file not found: ${template}`;
      return t`${errorBGText}${errorText}`;
    },

    unsupported_template_type: (ext: string, templatePath: FileRef) => {
      const errorText =
        `Unsupported template type: ${ext}\n` +
        `Only .ts, .njk, and .json templates are supported.\n` +
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
        `${string.upperfirst(domain)} composition is invalid:\n${issueList}`;
      return t`${errorBGText}${errorText}`;
    },

    destination_file_exists: (path: string) => {
      const pathText = cli.bg.yellow(" " + path + " ");
      const errorText =
        `Destination file ${pathText} already exists.\n` +
        `Ask the user whether to overwrite, then re-run with --overwrite.`;
      return t`${errorBGText}${errorText}`;
    },

    modify_target_not_found: (path: string) => {
      const errorText = `Target file for modification not found: ${path}`;
      return t`${errorBGText}${errorText}`;
    },

    modify_anchor_not_found: (anchor: string, path: string) => {
      const errorText = `Anchor "${anchor}" not found in: ${path}`;
      return t`${errorBGText}${errorText}`;
    },

    modify_anchor_ambiguous: (anchor: string, path: string) => {
      const errorText = `Anchor "${anchor}" appears multiple times in: ${path}`;
      return t`${errorBGText}${errorText}`;
    },

    modify_template_invalid_json: (template: string) => {
      const errorText = `Modify template did not produce valid JSON: ${template}`;
      return t`${errorBGText}${errorText}`;
    },

    git_repo_required: () => {
      const errorText = "Git repository required. Run \"git init\" first.";
      return t`${errorBGText}${errorText}`;
    },

    worktree_creation_failed: (message: string) => {
      const errorText = `Failed to create git worktree: ${message}`;
      return t`${errorBGText}${errorText}`;
    },

    worktree_apply_failed: (errors: string[]) => {
      const errorList = errors.map(e => `  - ${e}`).join("\n");
      const errorText = `Apply failed in worktree, no changes made:\n${errorList}`;
      return t`${errorBGText}${errorText}`;
    },
  });
}

const output_template_apply_errors = createOutputApplyErrors("template");
const output_feature_apply_errors = createOutputApplyErrors("feature");

export type OutputTemplateApplyErrorCode =
  keyof typeof output_template_apply_errors;

export type OutputFeatureApplyErrorCode =
  keyof typeof output_feature_apply_errors;

export const OutputTemplateApplyErrorCode = Object.fromEntries(
  Object.keys(output_template_apply_errors).map(k => [k, k]),
) as { [K in OutputTemplateApplyErrorCode]: K };

export const OutputFeatureApplyErrorCode = Object.fromEntries(
  Object.keys(output_feature_apply_errors).map(k => [k, k]),
) as { [K in OutputFeatureApplyErrorCode]: K };

const errors = {
  template: output_template_apply_errors,
  feature: output_feature_apply_errors,
};

export default errors;