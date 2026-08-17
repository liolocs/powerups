import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

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
      template: "templates/command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts",
    },
    {
      type: "create",
      name: "errors",
      template: "templates/errors.ts",
      outputPath: "packages/cli/src/private/errors/{{commandName}}Errors.ts",
    },
    {
      type: "create",
      name: "spec",
      template: "templates/spec.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/{{commandName}}.spec.ts",
    },
    {
      type: "create",
      name: "barrel",
      template: "templates/barrel.ts",
      outputPath: "packages/cli/src/commands/{{commandName}}.ts",
    },
  ],
};

export default defineInstructions(instructions, import.meta.url);