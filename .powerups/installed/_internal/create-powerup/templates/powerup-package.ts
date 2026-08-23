export default function(variables: Record<string, string>): string {
  const { name, description } = variables;

  const pkg = {
    name,
    version: "1.0.0",
    description,
    type: "module",
    license: "MIT",
    publishConfig: {
      "access": "public",
    },
    "repository": {
      "type": "git",
      "url": `https://github.com/<your-username>/${name}`,
      "directory": "",
    },
    scripts: {
      build: "npx @liolocs/powerups-cli build",
      release: "commit-and-tag-version --preset conventionalcommits --path .",
      "release:dry-run": "commit-and-tag-version --preset conventionalcommits --path . --dry-run",
    },
    keywords: ["powerups-package"],
    powerup: { instructions: "index.ts", compatibility: {} },
    files: ["dist"],
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}