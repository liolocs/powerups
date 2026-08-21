import { type Instructions } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import { createPowerupPackageForTest, type DefaultTemplateForTest } from "#test-utils/create-powerup-for-test";
import build from "#commands/build/index";
import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import git from "#utils/git";

const defaultInstructions = (powerupName: string): Instructions => ({
  name: powerupName,
  type: "multi-use",
  description: "a test powerup",
  variables: {
    required: ["name"],
    optional: [],
  },
  intent: [
    "create a test component",
  ],
  steps: [
    {
      type: "create",
      name: "component",
      template: "templates/component.ts",
      outputPath: "src/components/{{name}}.ts",
    },
  ],
});

export default async function createFullyBuiltPowerupForTest({
  powerupName = "test-powerup",
  testRoot,
  instructions = defaultInstructions(powerupName),
  templates,
}: {
    powerupName?: string;
    testRoot: FileRef;
    instructions?: Instructions;
  templates?: DefaultTemplateForTest[];
}): Promise<{ instructions: Instructions; packageDir: FileRef }> {
  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );
  await createPowerupPackageForTest({
    powerupName,
    testRoot,
    instructions,
    templates,
  });

  await build.run({
    subcommands: [],
    flags: [],
    context: { root: packageDir },
  });

  return { instructions, packageDir };
}

export async function createSimpleScaffoldPowerupForTest({
  powerupName = "test-powerup",
  projectName = "new-project",
  testRoot,
}: {
  powerupName?: string;
  projectName?: string;
  testRoot: FileRef;
}) {
  const targetDir = testRoot.append(`/${projectName}`);
  await targetDir.create();
  await git.init({ cwd: targetDir });

  const instructionsForScaffoldingSimpleFile: Instructions = {
    name: powerupName,
    type: "single-use",
    description: "a test powerup",
    variables: {
      required: ["name"],
      optional: [],
    },
    intent: [
      "create a test component",
    ],
    steps: [
      {
        type: "create",
        name: "index",
        template: "templates/index.ts",
        outputPath: "index.ts",
      },
      {
        type: "create",
        name: "package.json",
        template: "templates/package.json.ts",
        outputPath: "package.json",
      },
    ],
  };

  // E.G. .powerups/installed/installed/_internal/cli-command/templates/component.ts
  const indexTemplateContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`export const \${name} = "";\\n\`;
}
`;
  const packageJsonTemplateContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`{
  "name": "${powerupName}",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
\\n\`;
  return \`export const \${name} = "";\\n\`;
}
`;

  const templates: DefaultTemplateForTest[] = [
    {
      name: "index",
      templatePath: "/templates/index.ts",
      content: indexTemplateContent,
    },
    {
      name: "package.json",
      templatePath: "/templates/package.json.ts",
      content: packageJsonTemplateContent,
    },
  ];

  const result = await createFullyBuiltPowerupForTest({
    powerupName,
    testRoot: targetDir,
    instructions: instructionsForScaffoldingSimpleFile,
    templates,
  });

  await targetDir.append("/.powerups/config.json").writeJSON({ packages: ["internal:" + powerupName] });

  try {
    await git.commitAll({ cwd: targetDir, message: "initial commit" });
  } catch (e) {
    console.error(e);
  }

  return {
    targetDir,
    ...result,
  };
}

export async function createSimpleGlobalScaffoldPowerupForTest({
  powerupName = "test-powerup",
  projectName = "new-project",
  globalRoot,
  testRoot,
}: {
  powerupName?: string;
  projectName?: string;
  globalRoot: FileRef;
  testRoot: FileRef;
}) {
  const targetDir = testRoot.append(`/${projectName}`);
  await targetDir.create();
  await git.init({ cwd: targetDir });

  const instructionsForScaffoldingSimpleFile: Instructions = {
    name: powerupName,
    type: "single-use",
    description: "a test powerup",
    variables: {
      required: ["name"],
      optional: [],
    },
    intent: [
      "create a test component",
    ],
    steps: [
      {
        type: "create",
        name: "index",
        template: "templates/index.ts",
        outputPath: "index.ts",
      },
      {
        type: "create",
        name: "package.json",
        template: "templates/package.json.ts",
        outputPath: "package.json",
      },
    ],
  };

  // E.G. .powerups/installed/_internal/cli-command/templates/component.ts
  const indexTemplateContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`export const \${name} = "";\\n\`;
}
`;
  const packageJsonTemplateContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`{
  "name": "${powerupName}",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
\\n\`;
  return \`export const \${name} = "";\\n\`;
}
`;

  const templates: DefaultTemplateForTest[] = [
    {
      name: "index",
      templatePath: "/templates/index.ts",
      content: indexTemplateContent,
    },
    {
      name: "package.json",
      templatePath: "/templates/package.json.ts",
      content: packageJsonTemplateContent,
    },
  ];

  const result = await createFullyBuiltPowerupForTest({
    powerupName,
    testRoot: globalRoot,
    instructions: instructionsForScaffoldingSimpleFile,
    templates,
  });

  await targetDir.append("/.powerups/config.json").writeJSON({ packages: [] });
  await globalRoot.append("/config.json").writeJSON({ packages: ["internal:" + powerupName] });

  try {
    await git.commitAll({ cwd: targetDir, message: "initial commit" });
  } catch (e) {
    console.error(e);
  }

  return {
    targetDir,
    ...result,
  };
}