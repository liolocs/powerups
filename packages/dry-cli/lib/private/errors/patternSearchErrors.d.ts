declare const pattern_search_errors: {
    no_matching_patterns: () => import("@rcompat/error").TemplateError;
};
export type PatternSearchErrorCode = keyof typeof pattern_search_errors;
export declare const PatternSearchErrorCode: { [K in PatternSearchErrorCode]: K; };
export default pattern_search_errors;
//# sourceMappingURL=patternSearchErrors.d.ts.map