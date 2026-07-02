import error from "@rcompat/error";
import cli from "@rcompat/cli";
const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const metrics_errors = error.coded({
    dry_folder_not_found: () => {
        const errorText = `Dry folder not found. Run "dryai init" first.`;
        return t `${errorBGText}${errorText}`;
    },
});
export const MetricsErrorCode = Object.fromEntries(Object.keys(metrics_errors).map(k => [k, k]));
export default metrics_errors;
//# sourceMappingURL=metricsErrors.js.map