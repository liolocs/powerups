import getPackageManagerToUse from "#utils/use/run-powerup/steps/run-install-step/get-package-manager-to-use";
import { type InstallManifestEntry, type InstallStep } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import is from "@rcompat/is";
import { type BaseManifestProperties } from "#utils/use/run-powerup/run-step";

export default async function runInstallStep({
  step,
  isDryRun,
  destination,
}: {
  step: InstallStep;
  isDryRun: boolean;
  destination: FileRef;
}): Promise<{ manifest: Omit<InstallManifestEntry, BaseManifestProperties> }> {
  const { packageManager } = step;
  const packageManagerToUse = await getPackageManagerToUse({
    packageManager,
    destination,
  });

  let installedDependencies: { dependencies: string[]; devDependencies: string[]; peerDependencies: string[] };

  if (!isDryRun) {
    installedDependencies = await installAllDependencies({
      dependencies: step.dependencies ?? [],
      devDependencies: step.devDependencies ?? [],
      peerDependencies: step.peerDependencies ?? [],
      packageManager: packageManagerToUse,
      cwd: destination,
    });
  } else {
    installedDependencies = {
      dependencies: step.dependencies ?? [],
      devDependencies: step.devDependencies ?? [],
      peerDependencies: step.peerDependencies ?? [],
    };
  }

  const hadDependenciesToChange = is.truthy(step.dependencies?.length) ||
    is.truthy(step.devDependencies?.length) ||
    is.truthy(step.peerDependencies?.length);
  const hasNoDependencyChanges =
    is.falsy(installedDependencies.dependencies.length) &&
    is.falsy(installedDependencies.devDependencies.length) &&
    is.falsy(installedDependencies.peerDependencies.length);

  let status: InstallManifestEntry["status"] = "applied";

  if (hadDependenciesToChange && hasNoDependencyChanges) {
    status = "skipped-warning";
  }

  const installManifest: Omit<InstallManifestEntry, BaseManifestProperties> = {
    timestamp: new Date(),
    stepName: step.name,
    from: step.from?.name,
    stepType: "install",
    status,
    output: {
      type: "install",
      packageManager: packageManagerToUse,
      ...installedDependencies,
    },
  };

  return { manifest: installManifest };
}

async function installAllDependencies({
  dependencies,
  devDependencies,
  peerDependencies,
  packageManager,
  cwd,
}: {
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
    packageManager: "pnpm" | "yarn" | "bun" | "npm";
  cwd: FileRef;
}): Promise<{ dependencies: string[]; devDependencies: string[]; peerDependencies: string[] }> {
  let installedDependencies: string[] = [];
  if (is.truthy(dependencies)) {
    installedDependencies = await installPackages({
      dependencies: dependencies,
      packageManager,
      cwd,
      type: "main",
    });
  }

  let installedDevDependencies: string[] = [];
  if (is.truthy(devDependencies)) {
    installedDevDependencies = await installPackages({
      dependencies: devDependencies,
      packageManager,
      cwd,
      type: "dev",
    });
  }

  let installedPeerDependencies: string[] = [];
  if (is.truthy(peerDependencies)) {
    installedPeerDependencies = await installPackages({
      dependencies: peerDependencies,
      packageManager,
      cwd,
      type: "peer",
    });
  }

  return {
    dependencies: installedDependencies,
    devDependencies: installedDevDependencies,
    peerDependencies: installedPeerDependencies,
  };
}

async function installPackages({
  dependencies,
  packageManager,
  cwd,
  type,
}: {
  dependencies: string[];
    packageManager: "pnpm" | "yarn" | "bun" | "npm";
  cwd: FileRef;
  type: "dev" | "peer" | "main";
}): Promise<string[]> {
  const successfullyInstalled: string[] = [];

  for (const dependency of dependencies) {
    try {
      const flag = getInstallFlag({ type, packageManager });

      let installKeyWord = "add";

      if (packageManager === "npm") {
        installKeyWord = "install";
      }

      const command = `${packageManager} ${installKeyWord} ${dependency}${flag}`;
      await io.run(command, { cwd: cwd.path });

      successfullyInstalled.push(dependency);
    } catch (e) {
      console.error(e);
    }
  }

  return successfullyInstalled;
}

function getInstallFlag({
  type,
  packageManager,
}: {
  type: "dev" | "peer" | "main";
  packageManager: "pnpm" | "yarn" | "bun" | "npm";
}) {
  let flag: string = "";

  if (type === "dev") {
    if (packageManager === "yarn" || packageManager === "bun") {
      flag = " --dev";
    } else {
      flag = " --save-dev";
    }
  } else if (type === "peer") {
    if (packageManager === "yarn" || packageManager === "bun") {
      flag = " --peer";
    } else {
      flag = " --save-peer";
    }
  }

  return flag;
}
