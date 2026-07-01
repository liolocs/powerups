import error from "@rcompat/error";
import cli from "@rcompat/cli";
const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const generate_pattern_errors = error.coded({
    dry_folder_not_found: () => {
        const errorText = `Dry folder not found. Run "dryai init" first.`;
        return t `${errorBGText}${errorText}`;
    },
    pattern_already_exists: (name) => {
        const nameText = cli.bg.yellow(" " + name + " ");
        const errorText = `Pattern ${nameText} already exists.`;
        return t `${errorBGText}${errorText}`;
    },
    invalid_output_json: () => {
        const errorText = "Invalid JSON for --output flag.";
        return t `${errorBGText}${errorText}`;
    },
});
export const GeneratePatternErrorCode = Object.fromEntries(Object.keys(generate_pattern_errors).map(k => [k, k]));
export default generate_pattern_errors;
//# sourceMappingURL=patternGenerateErrors.js.map