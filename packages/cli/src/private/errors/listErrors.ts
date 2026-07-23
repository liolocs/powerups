import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const list_errors = error.coded({
  store_read_failed: (storePath: string, message: string) => {
    const errorText = `Failed to read store: ${storePath}: ${message}`;
    return t`${errorBGText}${errorText}`;
  },
});

export type ListErrorCode = keyof typeof list_errors;
export const ListErrorCode = Object.fromEntries(
  Object.keys(list_errors).map(k => [k, k]),
) as { [K in ListErrorCode]: K };

export default list_errors;