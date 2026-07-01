declare const generate_recipe_errors: {
    dry_folder_not_found: () => import("@rcompat/error").TemplateError;
    recipe_already_exists: (name: string) => import("@rcompat/error").TemplateError;
    invalid_output_json: () => import("@rcompat/error").TemplateError;
};
export type GenerateRecipeErrorCode = keyof typeof generate_recipe_errors;
export declare const GenerateRecipeErrorCode: { [K in GenerateRecipeErrorCode]: K; };
export default generate_recipe_errors;
//# sourceMappingURL=generateRecipeErrors.d.ts.map