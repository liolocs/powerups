import tokenize from "#commands/output/validate/tokenize";

export default function scoreIntent(
  output: { intent: string[] },
  queryKeywords: string[],
): number {
  const intentTokens = new Set<string>();

  for (const intentStr of output.intent) {
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