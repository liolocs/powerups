declare const init_errors: {
    dry_folder_exists: () => import("@rcompat/error").TemplateError;
};
export type InitErrorCode = keyof typeof init_errors;
export declare const InitErrorCode: { [K in InitErrorCode]: K; };
export default init_errors;
//# sourceMappingURL=initErrors.d.ts.map