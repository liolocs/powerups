import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import {
  readConfig,
  readGlobalConfig,
  getPackageSource,
} from "#utils/config";
import { reconstructGitSource } from "#utils/parse-specifier";
import { packageJsonSchema } from "#schemas/package";
import {
  CLI_NAME,
  MAIN_FOLDER,
  GLOBAL_ROOT,
  INTERNAL_FOLDER,
  NPM_STORE,
  GIT_STORE,
  PACKAGE_FILE,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  CLI_CMD,
} from "#constants";

interface InstalledPackage {
  source: string;        // reconstructed source specifier
  storeType: "internal" | "npm" | "git";
  location: "local" | "global";
  packageName: string;
  powerups: {
    multiUse: string[];
    singleUse: string[];
  };
}

const list = new Command({
  name: "list",
  description: "List installed powerup packages not yet added to this project",
  flags: [],
  subcommands: [],
  action: async (props) => {
    const root: FileRef = props?.context?.root ?? await runtime.projectRoot();

    // 1. Read project config and global config for registered sources
    const config = await readConfig(root);
    const globalConfig = await readGlobalConfig(props?.context?.homeDir);
    const registeredSources = new Set<string>();
    for (const entry of config?.packages ?? []) {
      registeredSources.add(getPackageSource(entry));
    }
    for (const entry of globalConfig?.packages ?? []) {
      registeredSources.add(getPackageSource(entry));
    }

    // 2. Scan all six store locations
    const localRoot = root.append(`/${MAIN_FOLDER}`);
    const globalRoot = fs.ref(GLOBAL_ROOT);

    const found: InstalledPackage[] = [];

    // Scan internal (local + global)
    for (const [location, storeRoot] of [
      ["local", localRoot],
      ["global", globalRoot],
    ] as const) {
      const internalDir = storeRoot.append(`/${INTERNAL_FOLDER}`);
      if (await fs.exists(internalDir)) {
        const entries = await internalDir.dirs();
        for (const entry of entries) {
          const pkg = await tryReadPackage(entry, "internal", location);
          if (pkg) found.push(pkg);
        }
      }
    }

    // Scan npm/node_modules (local + global)
    for (const [location, storeRoot] of [
      ["local", localRoot],
      ["global", globalRoot],
    ] as const) {
      const nodeModulesDir = storeRoot.append(`/${NPM_STORE}/node_modules`);
      if (await fs.exists(nodeModulesDir)) {
        const entries = await nodeModulesDir.dirs();
        for (const entry of entries) {
          // Skip the store's own managed package (powerups-extensions)
          if (entry.name === "powerups-extensions") continue;
          // Handle scoped packages (@scope/pkg)
          if (entry.name.startsWith("@")) {
            const subEntries = await entry.dirs();
            for (const sub of subEntries) {
              const pkg = await tryReadPackage(
                sub,
                "npm",
                location,
                `npm:${entry.name}/${sub.name}`,
              );
              if (pkg) found.push(pkg);
            }
            continue;
          }
          const pkg = await tryReadPackage(
            entry,
            "npm",
            location,
            `npm:${entry.name}`,
          );
          if (pkg) found.push(pkg);
        }
      }
    }

    // Scan git (local + global)
    for (const [location, storeRoot] of [
      ["local", localRoot],
      ["global", globalRoot],
    ] as const) {
      const gitDir = storeRoot.append(`/${GIT_STORE}`);
      if (await fs.exists(gitDir)) {
        await scanGitStore(gitDir, gitDir, location, found);
      }
    }

    // 3. Filter out registered packages
    const unregistered = found.filter(pkg => !registeredSources.has(pkg.source));

    // 4. Print results
    if (unregistered.length === 0) {
      cli.print("All installed packages are already registered.\n");
      return;
    }

    cli.print("Available packages not yet registered:\n\n");

    // Group by location
    const byLocation = { local: [], global: [] } as Record<string, InstalledPackage[]>;
    for (const pkg of unregistered) {
      byLocation[pkg.location].push(pkg);
    }

    for (const [location, packages] of Object.entries(byLocation)) {
      if (packages.length === 0) continue;
      cli.print(`${location}:\n`);
      const dim = cli.fg.dim;
      for (const pkg of packages) {
        cli.print(`  ${pkg.storeType}:  ${pkg.source}\n`);
        const parts: string[] = [];
        if (pkg.powerups.multiUse.length > 0) {
          parts.push(`${pkg.powerups.multiUse.join(", ")} (multi-use)`);
        }
        if (pkg.powerups.singleUse.length > 0) {
          parts.push(`${pkg.powerups.singleUse.join(", ")} (single-use)`);
        }
        if (parts.length > 0) {
          cli.print(`    powerups: ${parts.join("; ")}\n`);
        } else {
          cli.print(`    powerups: (none)\n`);
        }

        // Hints showing how to add the entire package or a particular powerup.
        const allPowerups = [...pkg.powerups.multiUse, ...pkg.powerups.singleUse];
        cli.print(`    ${dim("add all:")}   ${CLI_CMD} add ${pkg.source}\n`);
        if (allPowerups.length > 0) {
          const pad = `    ${" ".repeat("add all:   ".length)}`;
          allPowerups.forEach((name, i) => {
            const prefix = i === 0 ? `    ${dim("add one:")}   ` : pad;
            cli.print(`${prefix}${CLI_CMD} add ${pkg.source}#${name}\n`);
          });
        }
      }
      cli.print("\n");
    }
  },
});

/**
 * Recursively scan git store directories (domain/owner/repo) for packages.
 * A directory is treated as a package if it contains a package.json.
 */
async function scanGitStore(
  baseDir: FileRef,
  currentDir: FileRef,
  location: "local" | "global",
  found: InstalledPackage[],
  depth = 0,
): Promise<void> {
  const entries = await currentDir.dirs();
  for (const entry of entries) {
    // Check if this directory has a package.json
    const pkgJsonPath = entry.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      // This is a repo directory — reconstruct source
      const relativePath = entry.path.slice(baseDir.path.length + 1);
      const source = reconstructGitSource(`${GIT_STORE}/${relativePath}`);
      const pkg = await tryReadPackage(entry, "git", location, source);
      if (pkg) found.push(pkg);
    } else if (depth < 2) {
      // Recurse into domain/owner directories (max depth 2: domain/owner/repo)
      await scanGitStore(baseDir, entry, location, found, depth + 1);
    }
  }
}

/**
 * Try to read a package from a directory.
 * Returns null if the directory doesn't have a valid powerups package.json.
 */
async function tryReadPackage(
  dir: FileRef,
  storeType: "internal" | "npm" | "git",
  location: "local" | "global",
  explicitSource?: string,
): Promise<InstalledPackage | null> {
  const pkgJsonPath = dir.append(`/${PACKAGE_FILE}`);
  if (!(await fs.exists(pkgJsonPath))) return null;

  try {
    const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
    const active = pkgJson[CLI_NAME].active;

    const multiUseMap = active[MULTI_USE_FOLDER] ?? {};
    const singleUseMap = active[SINGLE_USE_FOLDER] ?? {};
    const multiUse = Object.keys(multiUseMap).filter(n => !n.includes(":"));
    const singleUse = Object.keys(singleUseMap).filter(n => !n.includes(":"));

    // Determine source specifier
    let source: string;
    if (explicitSource) {
      source = explicitSource;
    } else if (storeType === "internal") {
      source = dir.name; // bare package name
    } else if (storeType === "npm") {
      source = `npm:${pkgJson.name}`;
    } else {
      // git — source should have been passed explicitly
      source = explicitSource ?? pkgJson.name;
    }

    return {
      source,
      storeType,
      location,
      packageName: pkgJson.name,
      powerups: { multiUse, singleUse },
    };
  } catch {
    return null; // invalid package.json — skip
  }
}

export default list;