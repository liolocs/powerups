import tokenize from "#recipe/tokenize";
export default function scoreRecipe(recipe, queryKeywords) {
    const intentTokens = new Set();
    for (const intentStr of recipe.intent) {
        for (const token of tokenize(intentStr)) {
            intentTokens.add(token);
        }
    }
    let score = 0;
    for (const keyword of queryKeywords) {
        if (intentTokens.has(keyword)) {
            score++;
        }
    }
    return score;
}
//# sourceMappingURL=score-recipe.js.map