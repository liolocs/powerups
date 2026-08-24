import type { ResolvedVariable } from "#utils/use/resolved-variable";
import is from "@rcompat/is";

export default function buildVariables({
  name,
  description,
  intent,
  requiredVariables,
  optionalVariables,
  powerupType,
  outputPath,
}: {
  name: string;
  description?: string;
  intent?: string;
  requiredVariables?: string;
  optionalVariables?: string;
  powerupType?: string;
  outputPath: string;
}): ResolvedVariable {
  return {
    name,
    description: description ?? "",
    intent: intent ?? "",
    requiredVariables: requiredVariables ?? "",
    optionalVariables: optionalVariables ?? "",
    powerupType: is.defined(powerupType) && powerupType.length > 0 ? powerupType : "single-use",
    outputPath,
  };
}