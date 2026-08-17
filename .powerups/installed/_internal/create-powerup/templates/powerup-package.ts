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
    dependencies: {
      "@liolocs/powerups-sdk": "link:../../packages/sdk",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}