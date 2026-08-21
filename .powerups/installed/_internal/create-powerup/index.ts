import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = {
  name: "create-powerup",
  type: "multi-use",
  description: "Scaffold a new powerup package",
  variables: {
    required: ["name", "description"],
    optional: ["intent", "requiredVariables", "optionalVariables", "powerupType", "outputPath"],
    defaults: {
      outputPath: ".powerups/installed/_internal",
      powerupType: "single-use",
    },
  },
  intent: [
    "create a new powerup",
    "scaffold a powerup package",
    "bootstrap a powerup project",
  ],
  steps: [
    {
      type: "create",
      name: "index",
      template: "templates/powerup-index.ts",
      outputPath: "{{outputPath}}/{{name}}/index.ts",
    },
    {
      type: "create",
      name: "package",
      template: "templates/powerup-package.ts",
      outputPath: "{{outputPath}}/{{name}}/package.json",
    },
    {
      type: "create",
      name: "tsconfig",
      template: "templates/powerup-tsconfig.ts",
      outputPath: "{{outputPath}}/{{name}}/tsconfig.json",
    },
    {
      type: "create",
      name: "gitignore",
      template: "templates/gitignore.ts",
      outputPath: "{{outputPath}}/{{name}}/.gitignore",
    },
    {
      type: "install",
      name: "deps",
      target: "{{outputPath}}/{{name}}",
      dependencies: ["@liolocs/powerups-sdk"],
      devDependencies: ["commit-and-tag-version"],
      packageManager: "auto",
    },
  ],
};

export default defineInstructions(instructions, import.meta.url);