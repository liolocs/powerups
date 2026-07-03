import error from "@rcompat/error";
import cli from "@rcompat/cli";
import { CLI_NAME } from "#constants";
const t = error.template;
const errorLabel = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";
const printInit = CLI_NAME + " init";
const specifyHarness = `Harness options: \n\t${printInit} --harness=claude\n\t${printInit} --harness=opencode\n\t${printInit} --harness=pi\n\t${printInit} --harness=codex`;
const init_errors = error.coded({
    dry_folder_exists: () => {
        return t `${errorLabel} ${CLI_NAME} project already initialized.`;
    },
    no_harness_detected: () => {
        return t `${errorLabel} No AI coding harness detected.\n\n  ${specifyHarness}`;
    },
    invalid_harness: (value) => {
        return t `${errorLabel} Invalid harness: ${cli.fg.yellow(value)}\n\n  Valid values: claude, opencode, pi, codex`;
    },
    multiple_harnesses_detected: (harnesses) => {
        return t `${errorLabel} Multiple harnesses detected: ${cli.fg.yellow(harnesses.join(", "))}\n\n  ${specifyHarness}`;
    },
    agents_section_render_failed: (detail) => {
        return t `${errorLabel} Failed to render instruction section: ${detail}`;
    },
});
export const InitErrorCode = Object.fromEntries(Object.keys(init_errors).map(k => [k, k]));
export default init_errors;
//# sourceMappingURL=initErrors.js.map