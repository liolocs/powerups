import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const metrics_errors = error.coded({
  dry_folder_not_found: () => {
    const errorText = `Dry folder not found. Run "${CLI_NAME} init" first.`;
    return t`${errorBGText}${errorText}`;
  },
});

export type MetricsErrorCode = keyof typeof metrics_errors;

export const MetricsErrorCode = Object.fromEntries(
  Object.keys(metrics_errors).map(k => [k, k]),
) as { [K in MetricsErrorCode]: K };

export default metrics_errors;