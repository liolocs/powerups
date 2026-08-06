import { instructionsSchema, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: "cli-command",
  type: "multi-use",
  description: "Scaffold a CLI with a command",
  variables: {
    required: ["commandName", "description"],
    optional: ["flags", "errorCases"],
  },
  intent: [
    "create a new CLI command",
    "scaffold a command with flags and error handling",
    "generate a command with test spec",
  ],
  steps: [
    {
      type: "create",
      name: "command",
      template: "template/command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    {
      type: "create",
      name: "errors",
      template: "template/errors.ts",
      outputPath: "packages/cli/src/private/errors/{{commandName}}Errors.ts",
    },
    {
      type: "create",
      name: "spec",
      template: "template/spec.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/{{commandName}}.spec.ts",
    },
    {
      type: "create",
      name: "barrel",
      template: "template/barrel.ts",
      outputPath: "packages/cli/src/commands/{{commandName}}.ts",
    },
  ],
};

// Validate at module load time so mismatches are caught early
export default () => instructionsSchema.parse(instructions);