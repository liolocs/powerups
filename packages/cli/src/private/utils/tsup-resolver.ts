import { createRequire } from "node:module";
import type { FileRef } from "@rcompat/fs";
import build_errors from "#errors/buildErrors";

/** Minimal tsup programmatic API surface used by `pup build`. */
export interface TsupApi {
  build: (config: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Lazily resolve tsup from the powerup project being built (its node_modules),
 * not from the CLI's own dependencies. Throws build_errors.tsup_not_installed
 * with a friendly message if tsup is not installed in the target project.
 */
export async function resolveTsup(cwd: FileRef): Promise<TsupApi> {
  const packageJsonPath = cwd.append("/package.json").path;
  const projectRequire = createRequire(packageJsonPath);
  try {
    const mod = projectRequire("tsup") as TsupApi;
    if (!mod || typeof mod.build !== "function") {
      throw new Error("tsup build() not found");
    }
    return mod;
  } catch (e) {
    // re-throw our own error; otherwise the require error means tsup is absent
    if (e instanceof Error && e.message === "tsup build() not found") {
      throw build_errors.tsup_not_installed();
    }
    throw build_errors.tsup_not_installed();
  }
}