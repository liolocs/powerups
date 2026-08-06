import { instructionsSchema, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: "cli-with-sub-commands",
  type: "multi-use",
  description: "Scaffold a CLI with subcommands",
  variables: {
    required: [
      "commandName",
      "description",
      "subcommandName",
      "subcommandDescription",
      "subcommandFlags",
      "subcommandErrorCases"
    ],
    optional: [
      "errorCases"
    ]
  },
  intent: [
    "create a new command and perhaps subcommands for a CLI command",
    "scaffold a command and subcommands with flags and error handling",
    "combined command and subcommands",
  ],
  steps: [
    {
      type: "create",
      name: "parent-command.ts",
      template: "templates/parent-command.ts",
      outputPath: "packages/cli/src/private/commands/{{commandName}}/index.ts"
    },
   {
     type: "include",
     name: "cli-command",
     variables: {
       commandName: "{{commandName}}",
       description: "{{description}}",
       flags: "[]",
       errorCases: "{{errorCases}}"
      },
     excludeSteps: [
        "command.ts",
        "spec.ts"
      ]
    },
    {
      type: "include",
      name: "cli-subcommand",
      variables: {
        parentCommand: "{{commandName}}",
        subcommandName: "{{subcommandName}}",
        description: "{{subcommandDescription}}",
        flags: "{{subcommandFlags}}",
        errorCases: "{{subcommandErrorCases}}"
      },
      excludeSteps: [
        "modify-index"
      ]
    }
  ],
};

// Validate at module load time so mismatches are caught early
export default () => instructionsSchema.parse(instructions);