import tokenize from "#pattern/tokenize";

export default function scoreIntent(
  pattern: { intent: string[] },
  queryKeywords: string[],
): number {
  const intentTokens = new Set<string>();

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