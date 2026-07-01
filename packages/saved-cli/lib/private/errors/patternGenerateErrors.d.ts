declare const generate_pattern_errors: {
    dry_folder_not_found: () => import("@rcompat/error").TemplateError;
    pattern_already_exists: (name: string) => import("@rcompat/error").TemplateError;
    invalid_output_json: () => import("@rcompat/error").TemplateError;
};
export type GeneratePatternErrorCode = keyof typeof generate_pattern_errors;
export declare const GeneratePatternErrorCode: { [K in GeneratePatternErrorCode]: K; };
export default generate_pattern_errors;
//# sourceMappingURL=patternGenerateErrors.d.ts.map