import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_CMD, CLI_NAME, SINGULAR_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const pack_errors = error.coded({
  package_already_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Package ${nameText} already exists.`;
  },
  package_not_found: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Package ${nameText} not found in ${CLI_CMD} internal folder.`;
  },
  global_destination_exists: (name: string) => {
    const nameText = cli.bg.yellow(" " + name + " ");
    return t`${errorBGText}Package ${nameText} already exists globally. Remove it first or use a different name.`;
  },
  invalid_package_name: (name: string) => {
    return t`${errorBGText}Invalid package name: "${name}". Package names must not be empty or contain slashes.`;
  },
  subpower_unresolvable: (subName: string, parentName: string) => {
    return t`${errorBGText}Sub-${SINGULAR_NAME} ${subName} included by ${parentName} could not be resolved. Ensure it is in a config-listed package.`;
  },
  circular_include: (chain: string) => {
    return t`${errorBGText}Circular include detected: ${chain}`;
  },
  global_not_writable: () => {
    return t`${errorBGText}Global ${CLI_NAME} directory is not accessible or writable.`;
  },
  invalid_move_destination: (dest: string) => {
    return t`${errorBGText}Invalid move destination: "${dest}". Only "global" is supported.`;
  },
});

export type PackErrorCode = keyof typeof pack_errors;

export const PackErrorCode = Object.fromEntries(
  Object.keys(pack_errors).map(k => [k, k]),
) as { [K in PackErrorCode]: K };

export default pack_errors;