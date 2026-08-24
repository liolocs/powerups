import type { ResolvedVariable } from "#utils/use/resolved-variable";

export default function applyVariablesToTemplateString({
  templateString,
  variables,
}: {
  templateString: string;
  variables: ResolvedVariable;
}): string {
  return templateString.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    const key = Object.keys(variables).find(
      matchedKey => matchedKey.toLowerCase() === token.toLowerCase(),
    );

    return key !== undefined ? variables[key] : match;
  });
}