export default function(variables: Record<string, string>): string {
  const { name, description } = variables;

  const pkg = {
    name,
    version: "1.0.0",
    description,
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
      "@liolocs/powerups-sdk": "link:../../packages/sdk",
      "tsup": "^8.5.1",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}