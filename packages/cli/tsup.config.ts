import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "lib",
  sourcemap: true,
  clean: false, // don't wipe tsgo's .d.ts / template output                                                                                            
  splitting: false,
  // Force-inline the workspace program. Everything in `dependencies`                                                                                            
  // (@rcompat/*, nunjucks, pema) is auto-externalized and stays installable.                                                                                    
  noExternal: ["@pwrp/program"],
  // banner: { js: "#!/usr/bin/env node" },
  define: { "process.env.BUNDLED": '"1"' },   
});