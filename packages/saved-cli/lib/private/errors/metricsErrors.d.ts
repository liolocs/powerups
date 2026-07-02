declare const metrics_errors: {
    dry_folder_not_found: () => import("@rcompat/error").TemplateError;
};
export type MetricsErrorCode = keyof typeof metrics_errors;
export declare const MetricsErrorCode: { [K in MetricsErrorCode]: K; };
export default metrics_errors;
//# sourceMappingURL=metricsErrors.d.ts.map