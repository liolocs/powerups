import getPackageManagerToUse from "#utils/use/run-powerup/steps/run-install-step/get-package-manager-to-use";
import { type InstallManifestEntry, type InstallStep } from "@liolocs/powerups-sdk";
import cli from "@rcompat/cli";
import { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import is from "@rcompat/is";
import { type BaseManifestProperties } from "#utils/use/run-powerup/run-step";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import applyVariablesToTemplateString from "#utils/use/apply-variables-to-template-string";
import use_errors from "#errors/useErrors";
import getErrorMessage from "#errors/get-error-message";
import checkNetworkConnectivity, {
  type CheckNetworkConnectivity,
} from "#utils/shared/check-network-connectivity/index";

const NETWORK_CHECK_TIMEOUT_MS = 5_000;
const INSTALL_COMMAND_TIMEOUT_MS = 120_000;
const INSTALL_COMMAND_KILL_GRACE_MS = 1_000;

export default async function runInstallStep({
  step,
  isDryRun,
  destination,
  variables,
  checkNetwork = checkNetworkConnectivity,
}: {
  step: InstallStep;
  isDryRun: boolean;
  destination: FileRef;
  variables: ResolvedVariable;
  checkNetwork?: CheckNetworkConnectivity;
}): Promise<{ manifest: Omit<InstallManifestEntry, BaseManifestProperties> }> {
  const { packageManager, target } = step;

  const installDir = is.defined(target)
    ? destination.append(`/${applyVariablesToTemplateString({ templateString: target, variables })}`)
    : destination;

  const packageManagerToUse = await getPackageManagerToUse({
    packageManager,
    destination: installDir,
  });

  const stepDependencies = {
    dependencies: step.dependencies ?? [],
    devDependencies: step.devDependencies ?? [],
    peerDependencies: step.peerDependencies ?? [],
  };

  let installedDependencies: { dependencies: string[]; devDependencies: string[]; peerDependencies: string[] } = {
    dependencies: [],
    devDependencies: [],
    peerDependencies: [],
  };

  if (!isDryRun) {
    const allDependencies = [
      ...stepDependencies.dependencies,
      ...stepDependencies.devDependencies,
      ...stepDependencies.peerDependencies,
    ];

    if (is.truthy(allDependencies.length)) {
      cli.print(cli.fg.dim(
        `Installing dependencies with ${packageManagerToUse}: ${allDependencies.join(", ")}\n`,
      ));

      const connectivity = await checkNetwork({ timeoutMs: NETWORK_CHECK_TIMEOUT_MS });

      if (connectivity.online) {
        installedDependencies = await installAllDependencies({
          dependencies: stepDependencies.dependencies,
          devDependencies: stepDependencies.devDependencies,
          peerDependencies: stepDependencies.peerDependencies,
          packageManager: packageManagerToUse,
          cwd: installDir,
        });
      } else {
        cli.print(`${use_errors.install_step_offline({
          stepName: step.name,
          packageManager: packageManagerToUse,
          dependencies: allDependencies,
          destination: installDir.path,
        }).message}\n`);
      }
    }
  } else {
    installedDependencies = stepDependencies;
  }

  const hadDependenciesToChange = is.truthy(stepDependencies.dependencies.length) ||
    is.truthy(stepDependencies.devDependencies.length) ||
    is.truthy(stepDependencies.peerDependencies.length);
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

      const installKeyword = packageManager === "npm" ? "install" : "add";

      const command = `${packageManager} ${installKeyword} ${dependency}${flag}`;
      await runInstallCommand({ command, cwd: cwd.path });

      successfullyInstalled.push(dependency);
    } catch (error) {
      const errorText = getErrorMessage(error);
      console.error(`Failed to install ${dependency} with ${packageManager}:`);
      console.error(errorText.length > 0 ? errorText
        : "(no error output — the command may have been killed after a timeout)");
    }
  }

  return successfullyInstalled;
}

async function runInstallCommand({ command, cwd }: { command: string; cwd: string }): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutError = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(
      `${command} timed out after ${INSTALL_COMMAND_TIMEOUT_MS / 1000}s — the package registry may be unreachable.`,
    )), INSTALL_COMMAND_TIMEOUT_MS);
  });

  try {
    const installPromise = io.run(command, {
      cwd,
      timeout: INSTALL_COMMAND_TIMEOUT_MS + INSTALL_COMMAND_KILL_GRACE_MS,
    });

    return await Promise.race([installPromise, timeoutError]);
  } finally {
    clearTimeout(timeoutId);
  }
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
