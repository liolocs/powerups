import type { ResolvedVariable } from "#utils/use/resolved-variable";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";

export default function resolveOutputPath({
  outputPath,
  variables,
}: {
  outputPath: string;
  variables: ResolvedVariable;
}): string {
  return applyVariablesToTemplateString({ templateString: outputPath, variables });
}