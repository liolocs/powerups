import tokenize from "#commands/pattern/tokenize";
export default function scoreIntent(pattern, queryKeywords) {
    const intentTokens = new Set();
    for (const intentStr of pattern.intent) {
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
//# sourceMappingURL=score-intent.js.map