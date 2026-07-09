import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import is from "@rcompat/is";
import type { JSONValue } from "@rcompat/type";
import { instructionsSchema } from "#schemas/instruction";

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
interface MergeDepsParams {
  existing: Record<string, string> | undefined;
  newDeps: string[];
  pkgLabel: string;
}

function mergeDeps({
  existing,
  newDeps,
  pkgLabel,
}: MergeDepsParams): { merged: Record<string, string>; warnings: string[] } {
  const merged = { ...(existing ?? {}) };
  const warnings: string[] = [];

  for (const dep of newDeps) {
    const { name, version } = parseDep(dep);
    if (is.defined(merged[name])) {
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
    const packageJsonPath = is.defined(targetPath)
      ? projectRoot.append(`/${targetPath}/package.json`)
      : projectRoot.append("/package.json");
    const packageLocationLabel = is.defined(targetPath) ? targetPath : "root";

    // Check if package.json exists
    if (!(await fs.exists(packageJsonPath))) {
      cli.print(`Warning: Target package.json not found at ${packageLocationLabel}, skipping dependency group.\n`);
      continue;
    }

    const hasDependencies = is.truthy(group.dependencies?.length);
    const hasDevDependencies = is.truthy(group.devDependencies?.length);
    const hasPeerDependencies = is.truthy(group.peerDependencies?.length);

    if (isDryRun) {
      cli.print(`=== Dependencies for ${packageLocationLabel} ===\n`);

      if (hasDependencies) {
        cli.print(`  dependencies: ${group.dependencies!.join(", ")}\n`);
      }
      if (hasDevDependencies) {
        cli.print(`  devDependencies: ${group.devDependencies!.join(", ")}\n`);
      }
      if (hasPeerDependencies) {
        cli.print(`  peerDependencies: ${group.peerDependencies!.join(", ")}\n`);
      }
      continue;
    }

    // Real run: read, merge, write
    // package.json is always a JSON object; cast to a mutable record for editing
    const packageJsonContents: JSONValue = await packageJsonPath.json();
    const packageJson = packageJsonContents as Record<string, JSONValue>;

    const warnings: string[] = [];

    if (hasDependencies) {
      const { merged, warnings: mergeWarnings } = mergeDeps({
        existing: packageJson.dependencies as Record<string, string> | undefined,
        newDeps: group.dependencies!,
        pkgLabel: packageLocationLabel,
      });
      packageJson.dependencies = merged;
      warnings.push(...mergeWarnings);
    }

    if (hasDevDependencies) {
      const { merged, warnings: mergeWarnings } = mergeDeps({
        existing: packageJson.devDependencies as Record<string, string> | undefined,
        newDeps: group.devDependencies!,
        pkgLabel: packageLocationLabel,
      });
      packageJson.devDependencies = merged;
      warnings.push(...mergeWarnings);
    }

    if (hasPeerDependencies) {
      const { merged, warnings: mergeWarnings } = mergeDeps({
        existing: packageJson.peerDependencies as Record<string, string> | undefined,
        newDeps: group.peerDependencies!,
        pkgLabel: packageLocationLabel,
      });
      packageJson.peerDependencies = merged;
      warnings.push(...mergeWarnings);
    }

    for (const warning of warnings) {
      cli.print(`Warning: ${warning}\n`);
    }

    await packageJsonPath.writeJSON(packageJson);

    cli.print(`Updated ${packageLocationLabel}/package.json\n`);
  }

  // Detect lock file and run install
  const detectedPackageManager = await detectPackageManager(projectRoot);

  if (isDryRun) {
    if (is.truthy(detectedPackageManager)) {
      cli.print(`\nWould run: ${detectedPackageManager!.command}\n`);
    } else {
      cli.print(`\nNo lock file detected. Dependencies would be written but not installed.\n`);
    }
    return;
  }

  if (is.falsy(detectedPackageManager)) {
    cli.print(
      "Warning: No lock file detected. package.json has been updated, but dependencies were not installed. " +
      "Please run your package manager's install command manually.\n",
    );
    return;
  }

  // Run the install command
  try {
    cli.print(`Running ${detectedPackageManager!.command}...\n`);

    const stdout = await io.run(detectedPackageManager!.command, {
      cwd: projectRoot.path,
    });

    if (is.truthy(stdout)) {
      cli.print(stdout);
    }

    cli.print("Dependency installation complete.\n");
  } catch (error) {
    // io.run rejects with the stderr output on failure
    if (typeof error === "string" && is.truthy(error)) {
      cli.print(error);
    }

    cli.print(
      `Warning: Dependency installation failed. Generated files are in place. ` +
      `Please run '${detectedPackageManager!.command}' manually.\n`,
    );
  }
}

export interface CollectDependenciesOptions {
  outputName: string;
  outputsFolder: FileRef;
}

/**
 * Collect packageDependencies from a template/feature and all its subtemplates.
 * Recursively walks the includes tree, loading each instructions.json to
 * gather its packageDependencies. Returns a flat array of all groups.
 */
export async function collectDependencies({
  outputName,
  outputsFolder,
}: CollectDependenciesOptions): Promise<PackageDependencyGroup[]> {
  const outputFolder = outputsFolder.append(`/${outputName}`);
  const outputPath = outputFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  const deps: PackageDependencyGroup[] = [
    ...(instructions.packageDependencies ?? []),
  ];

  if (is.defined(instructions.includes) && is.truthy(instructions.includes)) {
    for (const ref of instructions.includes) {
      const childDeps = await collectDependencies({
        outputName: ref.name,
        outputsFolder,
      });

      deps.push(...childDeps);
    }
  }

  return deps;
}