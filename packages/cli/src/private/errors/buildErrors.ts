import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, SINGULAR_NAME, KEYWORD_PACKAGE } from "#constants";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const build_errors = error.coded({
  no_package_json: () => {
    const errorText =
      `No package.json found in the current directory.\n\n` +
      `Run "${CLI_CMD} build" from inside a ${SINGULAR_NAME} directory.`;
    return t`${errorBGText}${errorText}`;
  },

  not_a_powerups_package: () => {
    const errorText =
      `This directory is not a ${SINGULAR_NAME} package.\n` +
      `package.json must have "${KEYWORD_PACKAGE}" in its keywords array.\n\n` +
      `Run "${CLI_CMD} build" from inside a ${SINGULAR_NAME} directory.`;
    return t`${errorBGText}${errorText}`;
  },

  malformed_powerup_property: (detail: string) => {
    const errorText =
      `The "powerup" property in package.json is malformed.\n` +
      `Expected an object with an "instructions" string field.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },

  invalid_instructions_file: (fileName: string) => {
    const errorText =
      `Invalid instructions file: ${fileName}\n` +
      `Must default-export the result of defineInstructions(...).`;
    return t`${errorBGText}${errorText}`;
  },

  tsup_not_installed: () => {
    const errorText =
      `pup build requires tsup — add it as a devDependency of this powerup package.\n` +
      `Run: npm i -D tsup (or pnpm add -D tsup)`;
    return t`${errorBGText}${errorText}`;
  },

  build_validation_failed: (issues: string[]) => {
    const issueList = issues.map(i => `  - ${i}`).join("\n");
    const errorText = `Build validation failed:\n${issueList}`;
    return t`${errorBGText}${errorText}`;
  },

  child_not_built: (childName: string) => {
    const errorText =
      `Included powerup "${childName}" has no dist/ — build it first.\n` +
      `Run "pup build" in the ${childName} package, then rebuild the parent.`;
    return t`${errorBGText}${errorText}`;
  },

  malformed_instructions: (detail: string) => {
    const errorText =
      `The instructions object is malformed.\n\n` +
      `Details: ${detail}`;
    return t`${errorBGText}${errorText}`;
  },

  template_not_found: (templatePath: string) => {
    const errorText = `Template file not found: ${templatePath}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type BuildErrorCode = keyof typeof build_errors;

export const BuildErrorCode = Object.fromEntries(
  Object.keys(build_errors).map(k => [k, k]),
) as { [K in BuildErrorCode]: K };

export default build_errors;