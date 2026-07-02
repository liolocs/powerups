import type { FileRef } from "@rcompat/fs";
declare const pattern_run_errors: {
    dry_folder_not_found: () => import("@rcompat/error").TemplateError;
    missing_pattern_name: () => import("@rcompat/error").TemplateError;
    pattern_not_found: (name: string) => import("@rcompat/error").TemplateError;
    missing_variable: (variable: string, flagName: string) => import("@rcompat/error").TemplateError;
    template_not_found: (template: string) => import("@rcompat/error").TemplateError;
    unsupported_template_type: (ext: string, templatePath: FileRef) => import("@rcompat/error").TemplateError;
    invalid_ts_template: (templatePath: FileRef) => import("@rcompat/error").TemplateError;
    unsupported_runtime: (name: string) => import("@rcompat/error").TemplateError;
    template_execution_error: (template: string, message: string) => import("@rcompat/error").TemplateError;
};
export type PatternRunErrorCode = keyof typeof pattern_run_errors;
export declare const PatternRunErrorCode: { [K in PatternRunErrorCode]: K; };
export default pattern_run_errors;
//# sourceMappingURL=patternRunErrors.d.ts.map