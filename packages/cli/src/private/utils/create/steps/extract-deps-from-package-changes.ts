// import type { PackageDependencyGroup } from "#utils/dependencies";
import type { Instructions } from "#schemas/instruction";
import type { GitChange } from "#utils/create/git/git-status";
import fs, { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import is from "@rcompat/is";
import path from "node:path";

export async function extractDepsFromPackageChanges({
  change,
  projectRoot,
}: {
  change: GitChange;
  projectRoot: FileRef;
}) {
  const warnings: string[] = [];
  const newPackageDependencies: PackageDependencyGroup[] = [];

  if (path.basename(change.path) === "package.json") {
    // Extract dependencies from package.json diff instead of creating a file modification
    let preImage: string;
    try {
      preImage = await io.run(
        `git show HEAD:"${change.path}"`,
        { cwd: projectRoot.path },
      );
    } catch {
      warnings.push(`${change.path}: could not read pre-image from HEAD`);

      return { warnings, packageDependencies: [] };
    }
    const postImagePath = projectRoot.append(`/${change.path}`);
    if (!(await fs.exists(postImagePath))) {
      warnings.push(`${change.path}: post-image file not found`);

      return { warnings, packageDependencies: [] };
    }
    const postImage = await postImagePath.text();

    const { dependencies: extractedDeps, hasNonDependencyChanges } =
      extractPackageDependencies({
        preImage,
        postImage,
        filePath: change.path,
      });

    if (extractedDeps.length > 0) {
      newPackageDependencies.push(...extractedDeps);
    }

    if (hasNonDependencyChanges) {
      warnings.push(
        `${change.path}: has non-dependency changes (e.g. scripts, version bumps) not captured — manual review required`,
      );
    }
  }

  return {
    warnings,
    packageDependencies: newPackageDependencies,
  };
}

type DependencyType = "dependencies" | "devDependencies" | "peerDependencies";

const DEPENDENCY_TYPES: DependencyType[] = ["dependencies", "devDependencies", "peerDependencies"];

type PackageDependencyGroup = NonNullable<Instructions["packageDependencies"]>[number];

/**
 * Extract added dependencies from a package.json diff.
 * Returns the dependency groups for instruction.json's packageDependencies field,
 * plus a flag indicating whether there are non-dependency changes that would
 * require a separate file modification.
 */
export function extractPackageDependencies({
  preImage,
  postImage,
  filePath,
}: {
  preImage: string;
  postImage: string;
  filePath: string;
}): {
  dependencies: PackageDependencyGroup[];
  hasNonDependencyChanges: boolean;
} {
  let oldPkg: Record<string, unknown>;
  let newPkg: Record<string, unknown>;
  try {
    oldPkg = JSON.parse(preImage);
    newPkg = JSON.parse(postImage);
  } catch {
    return { dependencies: [], hasNonDependencyChanges: true };
  }

  const dir = path.dirname(filePath);
  const target = dir !== "." ? dir : undefined;

  const group = {} as PackageDependencyGroup;
  if (is.defined(target)) {
    group.target = target;
  }

  const depTypeSet = new Set<string>(DEPENDENCY_TYPES);
  let hasVersionChanges = false;

  for (const depType of DEPENDENCY_TYPES) {
    const oldDeps = (oldPkg[depType] ?? {}) as Record<string, string>;
    const newDeps = (newPkg[depType] ?? {}) as Record<string, string>;

    const added: string[] = [];
    for (const [name, version] of Object.entries(newDeps)) {
      if (!(name in oldDeps)) {
        added.push(`${name}@${version}`);
      } else if (oldDeps[name] !== version) {
        hasVersionChanges = true;
        added.push(`${name}@${version}`);
      }
    }

    if (added.length > 0) {
      group[depType] = added;
    }
  }

  // Check for non-dependency changes (keys outside dependency sections)
  let hasNonDependencyChanges = false;
  const allKeys = new Set([...Object.keys(oldPkg), ...Object.keys(newPkg)]);
  for (const key of allKeys) {
    if (depTypeSet.has(key)) continue;
    if (JSON.stringify(oldPkg[key]) !== JSON.stringify(newPkg[key])) {
      hasNonDependencyChanges = true;
      break;
    }
  }

  const hasDeps = group.dependencies !== undefined
    || group.devDependencies !== undefined
    || group.peerDependencies !== undefined;
  if (!hasDeps) {
    return { dependencies: [], hasNonDependencyChanges };
  }

  return {
    dependencies: [group],
    hasNonDependencyChanges: hasNonDependencyChanges || hasVersionChanges,
  };
}