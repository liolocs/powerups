export default function(variables: Record<string, string>): string {
  const { name, description } = variables;

  const pkg = {
    name,
    version: "1.0.0",
    description,
    type: "module",
    scripts: {},
    keywords: ["powerups-package"],
    powerup: { instructions: "index.ts", compatibility: {} },
    files: ["dist"],
    release: "commit-and-tag-version --preset conventionalcommits --path .",
    "release:dry-run": "commit-and-tag-version --preset conventionalcommits --path . --dry-run",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}