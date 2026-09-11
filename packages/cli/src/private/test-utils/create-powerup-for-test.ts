import { CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import fs from "@rcompat/fs";
import { type Instructions } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import runtime from "@rcompat/runtime";
import path from "node:path";
import nodeFs from "node:fs";

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
      type: "dynamic-create",
      name: "component",
      template: "src/dynamic-create/component.ts",
      outputPath: "src/components/{{name}}.ts",
    },
  ],
});

const defaultTemplates = () => {
  const indexTemplateContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`export const \${name} = "";\\n\`;
}`;

  const templateComponentContent = `export default function(variables: Record<string, string>): string {
  const { name } = variables;
  return \`export const \${name} = "";\\n\`;
}`;

  return [
    {
      name: "index",
      templatePath: "/src/dynamic-create/index.ts",
      content: indexTemplateContent,
    },
    {
      name: "component",
      templatePath: "/src/dynamic-create/component.ts",
      content: templateComponentContent,
    },
  ];
};

export type DefaultTemplateForTest = {
  name: string;
  templatePath: string;
  content: string;
};

/**
 * Links the workspace SDK into a dynamically-scaffolded test powerup package so
 * Node's ESM resolver can find `@liolocs/powerups-sdk` at runtime, and returns
 * the `package.json` dependency specifier to declare for it.
 *
 * Linked at scaffold time rather than via `pnpm install`: dynamically created
 * test projects are wiped & recreated by test setup and never see an install,
 * and a `pnpm install` under tmp/ scopes to the enclosing workspace instead of
 * the fixture. Works at any folder depth/name.
 */
export async function createSdkDependencyForTest({ packageDir }: { packageDir: FileRef }): Promise<string> {
  const sdkPackageAbsolutePath = path.resolve((await runtime.projectRoot()).path, "packages/sdk");
  const liolocsNodeModulesRef = packageDir.append("/node_modules/@liolocs");
  await liolocsNodeModulesRef.create();

  const sdkSymlinkPath = path.resolve(liolocsNodeModulesRef.path, "powerups-sdk");
  nodeFs.rmSync(sdkSymlinkPath, { force: true, recursive: true });
  nodeFs.symlinkSync(path.relative(liolocsNodeModulesRef.path, sdkPackageAbsolutePath), sdkSymlinkPath, "dir");

  return `link:${path.relative(packageDir.path, sdkPackageAbsolutePath)}`;
}

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
 *     src/dynamic-create/
 *       component.ts    (template function used by the `dynamic-create` step)
 */
export async function createPowerupPackageForTest({
  powerupName = "test-powerup",
  testRoot,
  instructions = defaultInstructions(powerupName),
  templates = defaultTemplates(),
}:
  {
    powerupName?: string;
    testRoot: FileRef;
    instructions?: Instructions;
    templates?: DefaultTemplateForTest[];
  }): Promise<Instructions> {
  // Root of the powerup package: /tmp/.powerups/_internal/<powerupName>/
  const packageDir = testRoot.append(
    `/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}/${powerupName}`,
  );

  await fs.create(testRoot.append(`/${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}`));

  await fs.create(packageDir.append("/src/dynamic-create"));

  const sdkPackageLinkSpecifier = await createSdkDependencyForTest({ packageDir });

  // E.G. .powerups/_internal/cli-command/package.json
  const packageJsonContents = {
    name: powerupName,
    version: "1.0.0",
    description: "a test powerup",
    type: "module",
    scripts: { build: "pup author build" },
    keywords: ["powerups-package"],
    powerup: { instructions: "index.ts", compatibility: {} },
    files: ["dist"],
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    dependencies: {
      // Computed relative to this package's directory so it stays correct no
      // matter how deep under tmp/ or global-tmp/ the test project lives.
      "@liolocs/powerups-sdk": sdkPackageLinkSpecifier,
    },
  };
  await packageDir.append("/package.json").writeJSON(packageJsonContents);

  for (const template of templates) {
    const templateRef = packageDir.append(`${template.templatePath}`);
    await fs.create(templateRef.directory);
    await templateRef.write(template.content);
  }

  const indexTsContents = `import { defineInstructions, type Instructions } from "@liolocs/powerups-sdk";

const instructions: Instructions = ${JSON.stringify(instructions, null, 2)};

export default defineInstructions(instructions, import.meta.url);
`;
  await packageDir.append("/index.ts").write(indexTsContents);

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

  await io.run("pnpm install", { cwd: packageDir.path });

  return instructions;
}