import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const noExternal = ["@liolocs/program", "@liolocs/powerups-sdk"];
const external = Object.keys(pkg.dependencies ?? {})
  .filter((dep) => !noExternal.includes(dep));

await esbuild.build({
  entryPoints: ["src/bin.ts"],
  outdir: "lib",
  format: "esm",
  platform: "node",
  target: "node20",
  bundle: true,
  sourcemap: true,
  allowOverwrite: true,
  external,
  define: { "process.env.BUNDLED": '"1"' },
  // banner: { js: "#!/usr/bin/env node" },
  logLevel: "silent",
});   