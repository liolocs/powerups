import { CLI_FOLDER_NAME, INTERNAL_FOLDER } from "#constants";
import fs from "@rcompat/fs";
import { type Instructions } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";

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

/**
 * Creates a real, buildable powerup package on disk under
 * `/tmp/.powerups/_internal/<powerupName>/`, mirroring the layout of a
 * real powerup package such as `.powerups/_internal/cli-command/`:
 *
 *   <powerupName>/
 *     package.json      (keywords: ["powerups-package"], powerup property, exports)
 *     index.ts          (default-exports defineInstructions(instructions, import.meta.url))
 *     tsconfig.json
 *     .gitignore
 *     templates/
 *       component.ts    (template function used by the `create` step)
 */
export async function createPowerupPackageForTest({
  powerupName = "test-powerup",
  testRoot,
  instructions = defaultInstructions(powerupName),
}:
  {
    powerupName?: string;
    testRoot: FileRef;
    instructions?: Instructions;
  }): Promise<Instructions> {
  // Root of the powerup package: /tmp/.powerups/_internal/<powerupName>/
  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}/${powerupName}`,
  );

  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}/${INTERNAL_FOLDER}`));

  await fs.create(packageDir.append("/templates"));

  // E.G. .powerups/_internal/cli-command/package.json
  const packageJsonContents = {
    name: powerupName,
    version: "1.0.0",
    description: "a test powerup",
    type: "module",
    scripts: { build: "pup build" },
    keywords: ["powerups-package"],
    powerup: { instructions: "index.ts", compatibility: {} },
    files: ["dist"],
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    devDependencies: {
      // /tmp/.powerups/_internal/<powerupName> -> <projectRoot>/packages/sdk
      // is four directories up: <powerupName> -> _internal -> .powerups -> tmp -> <projectRoot>
      "@liolocs/powerups-sdk": "link:../../../../packages/sdk",
    },
  };
  await packageDir.append("/package.json").writeJSON(packageJsonContents);


  //  E.G. .powerups/_internal/cli-command/index.ts
  const indexTsContents = `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = ${JSON.stringify(instructions, null, 2)};

export default defineInstructions(instructions, import.meta.url);
`;
  await packageDir.append("/index.ts").write(indexTsContents);

  // E.G. .powerups/_internal/cli-command/templates/component.ts
  const templateContents = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`export const \${name} = "";\\n\`;
}
`;
  await packageDir.append("/templates/component.ts").write(templateContents);

  // E.G. .powerups/_internal/cli-command/tsconfig.json)
  const tsconfigContents = {
    compilerOptions: {
      allowJs: true,
      target: "esnext",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      erasableSyntaxOnly: true,
      types: ["node"],
      allowImportingTsExtensions: true,
      noEmit: true,
    },
    exclude: ["node_modules", "${configDir}/node_modules"],
  };
  await packageDir.append("/tsconfig.json").writeJSON(tsconfigContents);

  // E.G. .powerups/_internal/cli-command/.gitignore
  await packageDir.append("/.gitignore").write("node_modules\ndist\n");

  return instructions;
}