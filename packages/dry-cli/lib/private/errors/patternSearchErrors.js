import error from "@rcompat/error";
import cli from "@rcompat/cli";
const t = error.template;
const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const pattern_search_errors = error.coded({
    no_matching_patterns: () => {
        const errorText = "No matching patterns found.";
        return t `${errorBGText}${errorText}`;
    },
});
export const PatternSearchErrorCode = Object.fromEntries(Object.keys(pattern_search_errors).map(k => [k, k]));
export default pattern_search_errors;
//# sourceMappingURL=patternSearchErrors.js.map