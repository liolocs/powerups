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
      type: "dynamic-create",
      name: "index",
      template: "src/dynamic-create/powerup-index.ts",
      outputPath: "{{outputPath}}/{{name}}/index.ts",
    },
    {
      type: "dynamic-create",
      name: "create-repo-sh",
      template: "src/dynamic-create/create-repo-sh.ts",
      outputPath: "{{outputPath}}/{{name}}/scripts/create-github-repo.sh",
    },
    {
      type: "dynamic-create",
      name: "package",
      template: "src/dynamic-create/powerup-package.ts",
      outputPath: "{{outputPath}}/{{name}}/package.json",
    },
    {
      type: "dynamic-create",
      name: "tsconfig",
      template: "src/dynamic-create/powerup-tsconfig.ts",
      outputPath: "{{outputPath}}/{{name}}/tsconfig.json",
    },
    {
      type: "dynamic-create",
      name: "gitignore",
      template: "src/dynamic-create/gitignore.ts",
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