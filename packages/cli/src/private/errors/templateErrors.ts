import error from "@rcompat/error";
import cli from "@rcompat/cli";

const t = error.template;

const errorBGText = " " + cli.bg.red(cli.fg.white(" ERROR ")) + " ";

const template_errors = error.coded({
  steps_region_invalid: (detail: string) => {
    const errorText =
      `Could not read the steps array in index.ts: ${detail}\n\n` +
      `"pup author template" requires the steps array to be JSON-compatible (no TS expressions inside it).` +
      ` Convert the step by hand.`;
    return t`${errorBGText}${errorText}`;
  },
  step_not_found: (outputPath: string) => {
    const errorText =
      `No step found for output path "${outputPath}".\n\n` +
      `Run "pup author template" without arguments to list steps.`;
    return t`${errorBGText}${errorText}`;
  },
  already_dynamic: (outputPath: string) => {
    const errorText =
      `The step for "${outputPath}" is already dynamic (template-based).\n\n` +
      `Use "pup author template ${outputPath} --revert" to convert it back to static.`;
    return t`${errorBGText}${errorText}`;
  },
  not_dynamic: (outputPath: string) => {
    const errorText =
      `The step for "${outputPath}" is static (not template-based).\n\n` +
      `Drop --revert to convert it to dynamic.`;
    return t`${errorBGText}${errorText}`;
  },
  revert_needs_variables: (missing: string[]) => {
    const errorText =
      `This template references variables (${missing.join(", ")}) so reverting needs values to render with.\n\n` +
      `Provide them in preview.json ("variables") or as flags: --<name>=<value>`;
    return t`${errorBGText}${errorText}`;
  },
  invalid_engine: (value: string) => {
    const errorText =
      `Invalid --engine value "${value}". Must be "ts" or "njk".`;
    return t`${errorBGText}${errorText}`;
  },
});

export type TemplateErrorCode = keyof typeof template_errors;

export const TemplateErrorCode = Object.fromEntries(
  Object.keys(template_errors).map(k => [k, k]),
) as { [K in TemplateErrorCode]: K };

export default template_errors;
