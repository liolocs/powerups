function parseList(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) return [];
  return value.split(",").map(s => s.trim()).filter(s => s.length > 0);
}

export default function(variables: Record<string, string>): string {
  const { name, description, intent, requiredVariables, optionalVariables, powerupType } = variables;

  const intentArr = parseList(intent);
  const requiredArr = parseList(requiredVariables);
  const optionalArr = parseList(optionalVariables);
  const type = (powerupType && powerupType.length > 0) ? powerupType : "single-use";

  return `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: ${JSON.stringify(name)},
  type: ${JSON.stringify(type)},
  description: ${JSON.stringify(description)},
  variables: {
    required: ${JSON.stringify(requiredArr)},
    optional: ${JSON.stringify(optionalArr)},
  },
  intent: ${JSON.stringify(intentArr)},
  steps: [],
};

export default defineInstructions(instructions, import.meta.url);
`;
}