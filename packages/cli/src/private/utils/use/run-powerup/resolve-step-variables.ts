import type { Step } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/variables";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";

export function resolveStepVariables({
  step,
  variables,
}: {
  step: Step;
  variables: ResolvedVariable;
}): ResolvedVariable {
  const variableMap = (step as Step & { variableMap?: Record<string, string> }).variableMap;

  if (!variableMap) {
    return variables;
  }

  const stepVariables: ResolvedVariable = { ...variables };

  for (const [location, value] of Object.entries(variableMap)) {
    stepVariables[location] = applyVariablesToTemplateString({
      templateString: value,
      variables: stepVariables,
    });
  }

  return stepVariables;
}