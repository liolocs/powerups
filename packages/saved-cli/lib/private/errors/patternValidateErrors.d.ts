declare const pattern_validate_errors: {
    no_patterns_found: () => import("@rcompat/error").TemplateError;
    pattern_not_found: (name: string) => import("@rcompat/error").TemplateError;
    invalid_pattern: (name: string, message: string) => import("@rcompat/error").TemplateError;
    validation_failed: (count: number) => import("@rcompat/error").TemplateError;
};
export type PatternValidateErrorCode = keyof typeof pattern_validate_errors;
export declare const PatternValidateErrorCode: { [K in PatternValidateErrorCode]: K; };
export default pattern_validate_errors;
//# sourceMappingURL=patternValidateErrors.d.ts.map