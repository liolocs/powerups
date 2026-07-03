declare const init_errors: {
    dry_folder_exists: () => import("@rcompat/error").TemplateError;
    no_harness_detected: () => import("@rcompat/error").TemplateError;
    invalid_harness: (value: string) => import("@rcompat/error").TemplateError;
    multiple_harnesses_detected: (harnesses: string[]) => import("@rcompat/error").TemplateError;
    agents_section_render_failed: (detail: string) => import("@rcompat/error").TemplateError;
};
export type InitErrorCode = keyof typeof init_errors;
export declare const InitErrorCode: { [K in InitErrorCode]: K; };
export default init_errors;
//# sourceMappingURL=initErrors.d.ts.map