import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { instructionsSchema } from "#schemas/instruction";

const execAsync = promisify(exec);

export interface PackageManager {
  manager: string;
  command: string;
}

const LOCK_FILES: { file: string; manager: string; command: string }[] = [
  { file: "pnpm-lock.yaml", manager: "pnpm", command: "pnpm install" },
  { file: "package-lock.json", manager: "npm", command: "npm install" },
  { file: "yarn.lock", manager: "yarn", command: "yarn install" },
  { file: "bun.lockb", manager: "bun", command: "bun install" },
  { file: "bun.lock", manager: "bun", command: "bun install" },
];

/**
 * Detect the package manager from lock files at the project root.
 * Returns null if no lock file is found.
 * Checks files in priority order: pnpm > npm > yarn > bun.
 */
export async function detectPackageManager(
  projectRoot: FileRef,
): Promise<PackageManager | null> {
  for (const { file, manager, command } of LOCK_FILES) {
    if (await fs.exists(projectRoot.append(`/${file}`))) {
      return { manager, command };
    }
  }
  return null;
}

export type PackageDependencyGroup = {
  target?: string;
  dependencies?: string[];
  devDependencies?: string[];
  peerDependencies?: string[];
};

export interface ApplyDependenciesOptions {
  projectRoot: FileRef;
  packageDependencies: PackageDependencyGroup[];
  isDryRun: boolean;
}

/**
 * Parse a dependency string "package@version" into { name, version }.
 * Handles scoped packages like "@scope/pkg@^1.0.0".
 * If no version is specified, version is undefined.
 */
function parseDep(dep: string): { name: string; version?: string } {
  // Scoped package: @scope/pkg@version or @scope/pkg (no version)
  if (dep.startsWith("@")) {
    const lastAt = dep.lastIndexOf("@");
    if (lastAt === 0) {
      // No version: @scope/pkg
      return { name: dep };
    }
    return { name: dep.substring(0, lastAt), version: dep.substring(lastAt + 1) };
  }
  // Non-scoped: pkg@version or pkg (no version)
  const atIdx = dep.indexOf("@");
  if (atIdx === -1) {
    return { name: dep };
  }
  return { name: dep.substring(0, atIdx), version: dep.substring(atIdx + 1) };
}

/**
 * Merge a list of dep strings into a package.json dependency object.
 * Skips deps that already exist (same version silently, different version with warning).
 * Returns the merged object and a list of warnings produced.
 */
function mergeDeps(
  existing: Record<string, string> | undefined,
  newDeps: string[],
  pkgLabel: string,
): { merged: Record<string, string>; warnings: string[] } {
  const merged = { ...(existing ?? {}) };
  const warnings: string[] = [];
  for (const dep of newDeps) {
    const { name, version } = parseDep(dep);
    if (merged[name] !== undefined) {
      if (merged[name] === (version ?? merged[name])) {
        // Same version — skip silently
        continue;
      }
      warnings.push(
        `${name} already in ${pkgLabel} (${merged[name]}), skipping (would add ${version})`,
      );
      continue;
    }
    merged[name] = version ?? "*";
  }
  return { merged, warnings };
}

/**
 * Apply packageDependencies to the target project's package.json files
 * and run the install command.
 *
 * In dry-run mode: prints what would happen, writes nothing.
 * In real mode: writes to package.json, then runs the install command.
 */
export async function applyDependencies(options: ApplyDependenciesOptions): Promise<void> {
  const { projectRoot, packageDependencies, isDryRun } = options;

  if (packageDependencies.length === 0) return;

  // Collect all target package.json paths and their modifications
  for (const group of packageDependencies) {
    const targetPath = group.target ?? "";
    const pkgJsonPath = targetPath
      ? projectRoot.append(`/${targetPath}/package.json`)
      : projectRoot.append("/package.json");
    const pkgLabel = targetPath || "root";

    // Check if package.json exists
    if (!(await fs.exists(pkgJsonPath))) {
      cli.print(`Warning: Target package.json not found at ${pkgLabel}, skipping dependency group.\n`);
      continue;
    }

    if (isDryRun) {
      cli.print(`=== Dependencies for ${pkgLabel} ===\n`);
      if (group.dependencies?.length) {
        cli.print(`  dependencies: ${group.dependencies.join(", ")}\n`);
      }
      if (group.devDependencies?.length) {
        cli.print(`  devDependencies: ${group.devDependencies.join(", ")}\n`);
      }
      if (group.peerDependencies?.length) {
        cli.print(`  peerDependencies: ${group.peerDependencies.join(", ")}\n`);
      }
      continue;
    }

    // Real run: read, merge, write
    const pkg = await pkgJsonPath.json() as Record<string, unknown>;

    const warnings: string[] = [];

    if (group.dependencies?.length) {
      const { merged, warnings: w } = mergeDeps(
        pkg.dependencies as Record<string, string> | undefined,
        group.dependencies,
        pkgLabel,
      );
      pkg.dependencies = merged;
      warnings.push(...w);
    }

    if (group.devDependencies?.length) {
      const { merged, warnings: w } = mergeDeps(
        pkg.devDependencies as Record<string, string> | undefined,
        group.devDependencies,
        pkgLabel,
      );
      pkg.devDependencies = merged;
      warnings.push(...w);
    }

    if (group.peerDependencies?.length) {
      const { merged, warnings: w } = mergeDeps(
        pkg.peerDependencies as Record<string, string> | undefined,
        group.peerDependencies,
        pkgLabel,
      );
      pkg.peerDependencies = merged;
      warnings.push(...w);
    }

    for (const w of warnings) {
      cli.print(`Warning: ${w}\n`);
    }

    await pkgJsonPath.writeJSON(pkg);
    cli.print(`Updated ${pkgLabel}/package.json\n`);
  }

  // Detect lock file and run install
  const pm = await detectPackageManager(projectRoot);

  if (isDryRun) {
    if (pm) {
      cli.print(`\nWould run: ${pm.command}\n`);
    } else {
      cli.print(`\nNo lock file detected. Dependencies would be written but not installed.\n`);
    }
    return;
  }

  if (!pm) {
    cli.print(
      "Warning: No lock file detected. package.json has been updated, but dependencies were not installed. " +
      "Please run your package manager's install command manually.\n",
    );
    return;
  }

  // Run the install command
  try {
    cli.print(`Running ${pm.command}...\n`);
    const { stdout, stderr } = await execAsync(pm.command, {
      cwd: projectRoot.path,
    });
    if (stdout) cli.print(stdout);
    if (stderr) cli.print(stderr);
    cli.print("Dependency installation complete.\n");
  } catch (error) {
    cli.print(
      `Warning: Dependency installation failed. Generated files are in place. ` +
      `Please run '${pm.command}' manually.\n`,
    );
  }
}

/**
 * Collect packageDependencies from a template/feature and all its subtemplates.
 * Recursively walks the includes tree, loading each instructions.json to
 * gather its packageDependencies. Returns a flat array of all groups.
 */
export async function collectDependencies(
  outputName: string,
  outputsFolder: FileRef,
): Promise<PackageDependencyGroup[]> {
  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const deps: PackageDependencyGroup[] = [...(instructions.packageDependencies ?? [])];

  if (instructions.includes) {
    for (const ref of instructions.includes) {
      const childDeps = await collectDependencies(ref.name, outputsFolder);
      deps.push(...childDeps);
    }
  }

  return deps;
}