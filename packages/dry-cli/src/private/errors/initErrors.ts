import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const init_errors = error.coded({
  dry_folder_exists: () => {
    const errorText =
      "Dry folder already exists.";
    return t`${errorBGText}${errorText}`;
  },
});

export type InitErrorCode = keyof typeof init_errors;

export const InitErrorCode = Object.fromEntries(
  Object.keys(init_errors).map(k => [k, k]),
) as { [K in InitErrorCode]: K };

export default init_errors;