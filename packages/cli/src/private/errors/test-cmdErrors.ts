import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const testCmd_errors = error.coded({
  missing_arg: () => {
    const errorText = "Missing argument";
    return t`${errorBGText}${errorText}`;
  },
});

export type TestCmdErrorCode = keyof typeof testCmd_errors;

export const TestCmdErrorCode = Object.fromEntries(
  Object.keys(testCmd_errors).map(k => [k, k]),
) as { [K in TestCmdErrorCode]: K };

export default testCmd_errors;
