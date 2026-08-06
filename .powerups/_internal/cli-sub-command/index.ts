import { instructionsSchema, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: "cli-sub-command",
  type: "multi-use",
  description: "Scaffold a CLI with a command",
  variables: {
    required: [
      "parentCommand",
      "subcommandName",
      "description",
      "flags",
      "errorCases",
    ],
  },
  intent: [
    "create a new subcommand for a CLI command",
    "scaffold a subcommand with flags and error handling",
  ],
  steps: [
    {
      type: "create",
      name: "subcommand.ts",
      template: "templates/subcommand.ts",
      outputPath: "packages/cli/src/private/commands/{{parentCommand}}/{{subcommandName}}.ts",
    },
    {
      type: "create",
      name: "subcommand-spec.ts",
      template: "templates/subcommand-spec.ts",
      outputPath: "packages/cli/src/private/commands/{{parentCommand}}/{{subcommandName}}.spec.ts",
    },
    {
      type: "modify",
      name: "modify-index",
      template: "templates/modify-index.ts",
      outputPath: "packages/cli/src/private/commands/{{parentCommand}}/index.ts",
    },
    {
      type: "modify",
      name: "modify-errors",
      template: "templates/modify-errors.ts",
      outputPath: "packages/cli/src/private/errors/{{parentCommand}}Errors.ts",
    },
  ],
};

// Validate at module load time so mismatches are caught early
export default () => instructionsSchema.parse(instructions);