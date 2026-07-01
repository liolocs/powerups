declare const recipe_search_errors: {
    no_matching_recipes: () => import("@rcompat/error").TemplateError;
};
export type RecipeSearchErrorCode = keyof typeof recipe_search_errors;
export declare const RecipeSearchErrorCode: { [K in RecipeSearchErrorCode]: K; };
export default recipe_search_errors;
//# sourceMappingURL=recipeSearchErrors.d.ts.map