import error from "@rcompat/error";
import cli from "@rcompat/cli";
import type { FileRef } from "@rcompat/fs";
import { CAPITALIZED_SINGLULAR_CLI_NAME, CLI_CMD, CLI_FOLDER_NAME } from "#constants";
import { toKebabCase } from "#utils/variables";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const use_errors = error.coded({
  main_folder_not_found: () => {
    const errorText = `${CLI_FOLDER_NAME} folder not found. Run "${CLI_CMD} project init" first.`;
    return t`${errorBGText}${errorText}`;
  },

  unsupported_step_type: (type: string) => {
    const errorText =
      `Unsupported step type: ${type}\n` +
      `Only create, modify, delete, read, and install are supported.`;
    return t`${errorBGText}${errorText}`;
  },

  missing_name: () => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} name required.\n\nUsage: ${CLI_CMD} use <name> [variables]`;
    return t`${errorBGText}${errorText}`;
  },

  not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}${CAPITALIZED_SINGLULAR_CLI_NAME} ${nameText} not found.`;
  },

  missing_variables: (
    missing: string[],
    required: string[],
    name: string,
  ) => {
    const missingList = missing.join(", ");
    const requiredList = required
      .map(v => `  --${toKebabCase(v)}=<value>`)
      .join("\n");
    const example = `${CLI_CMD} use ${name} ${
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

  read_file_not_found: (path: string) => {
    const errorText = `Read step target file not found: ${path}`;
    return t`${errorBGText}${errorText}`;
  },

  read_json_path_not_found: (path: string, jsonPath: string) => {
    const errorText = `JSON path "${jsonPath}" not found in: ${path}`;
    return t`${errorBGText}${errorText}`;
  },

  read_json_parse_error: (path: string) => {
    const errorText = `Read step target is not valid JSON: ${path}`;
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
      `${CAPITALIZED_SINGLULAR_CLI_NAME} composition is invalid:\n${issueList}`;
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

  working_tree_dirty: () => {
    const errorText =
      "Working tree is not clean. Commit or stash your changes before running pup use.";
    return t`${errorBGText}${errorText}`;
  },

  instructions_not_built: (name: string) => {
    const errorText =
      `No built instructions for ${name}. Run "pup build" in the powerup package first.`;
    return t`${errorBGText}${errorText}`;
  },

  already_applied: (name: string) => {
    const errorText =
      `${CAPITALIZED_SINGLULAR_CLI_NAME} ${name} is single-use and has already been applied.`;
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

export type UseErrorCode = keyof typeof use_errors;

export const UseErrorCode = Object.fromEntries(
  Object.keys(use_errors).map(k => [k, k]),
) as { [K in UseErrorCode]: K };

export default use_errors;