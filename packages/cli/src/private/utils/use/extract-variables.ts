import is from "@rcompat/is";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/variables";
import use_errors from "#errors/useErrors";

export default function extractVariables({
  rawFlags,
  variables,
  excludeFlags,
  powerupName,
}: {
  rawFlags: { flag: string; value?: string }[];
  variables: Instructions["variables"];
  excludeFlags: string[];
  powerupName: string;
}): ResolvedVariable {
  const variableFlags = getVariableFlags({
    rawFlags,
    excludeFlags,
  });

  const extractedVariables: ResolvedVariable = getExtractedVariables({
    variableFlags,
  });

  const missingVariables: string[] = getMissingVariables({
    extractedVariables,
    required: variables.required,
  });

  if (missingVariables.length > 0) {
    throw use_errors.missing_variables(missingVariables, variables.required, powerupName);
  }

  const variablesWithDefaults: ResolvedVariable = getVariablesWithDefaults({
    extractedVariables,
    variables,
  });

  return variablesWithDefaults;
}

function getVariableFlags({
  rawFlags,
  excludeFlags,
}: {
  rawFlags: { flag: string; value?: string }[];
  excludeFlags: string[];
}): { flag: string; value?: string }[] {
  return rawFlags.filter(
    flag => !excludeFlags.includes(flag.flag),
  );
}

function getExtractedVariables({
  variableFlags,
}: {
  variableFlags: { flag: string; value?: string }[];
}): ResolvedVariable {
  const variables: ResolvedVariable = {};

  for (const flag of variableFlags) {
    const key = normalizeFlagName(flag.flag);
    variables[key] = flag.value ?? "";
  }

  return variables;
}

function getMissingVariables({
  extractedVariables,
  required,
}: {
  extractedVariables: ResolvedVariable;
  required: string[];
}): string[] {
  const missingVariables: string[] = [];

  for (const declared of required) {
    const matched = Object.keys(extractedVariables).find(
      key => key.toLowerCase() === declared.toLowerCase(),
    );

    if (is.falsy(matched)) {
      missingVariables.push(declared);
    }
  }

  return missingVariables;
}

function getVariablesWithDefaults({
  extractedVariables,
  variables,
}: {
  extractedVariables: ResolvedVariable;
  variables: Instructions["variables"];
}): ResolvedVariable {
  const variablesWithDefaults: ResolvedVariable = { ...extractedVariables };

  for (const declared of variables.optional ?? []) {
    const matched = Object.keys(variablesWithDefaults).find(
      key => key.toLowerCase() === declared.toLowerCase(),
    );

    if (is.falsy(matched)) {
      variablesWithDefaults[declared] = variables.defaults?.[declared] ?? "";
    }
  }

  return variablesWithDefaults;
}

function normalizeFlagName(flag: string): string {
  const stripped = flag.replace(/^--?/, "");
  const parts = stripped.split("-");

  return parts[0] +
    parts.slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
}